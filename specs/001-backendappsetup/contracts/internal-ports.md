# Contratos internos (ports) — Backend App Setup

Interfaces TypeScript que as camadas expõem umas às outras. Nomes em inglês; ficam no código
sob os caminhos de `architecture.md`.

---

## HealthRepository — `src/repositories/health/health.repository.ts`

Port de acesso a dados para o health-check. Única fronteira que fala com o driver `mongodb`.

```ts
export interface HealthRepository {
  /**
   * Faz `db.command({ ping: 1 })` com timeout curto.
   * Resolve `true` se o banco respondeu; `false` em qualquer erro/timeout.
   * NUNCA rejeita: exceção crua do driver é capturada e convertida internamente.
   */
  ping(): Promise<boolean>;
}
```

Implementação: `MongoHealthRepository` em `src/repositories/health/mongo-health.repository.ts`,
recebe `db: Db` (do Awilix). Registro Awilix: `healthRepository`.

---

## HealthService — `src/services/health/get-health.service.ts`

Regra de negócio do health-check (factory Awilix, um arquivo por operação).

```ts
export type GetHealth = () => Promise<HealthStatus>;

export interface HealthStatus {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  uptime: number; // segundos inteiros desde o start
}

export const makeGetHealth =
  (deps: { healthRepository: HealthRepository }): GetHealth =>
  async () => { /* ping -> compõe HealthStatus */ };
```

Registro Awilix: `getHealthService`. Regras: `db='up' ⇔ status='ok'`; `db='down' ⇔
status='degraded'`. Coberto por **teste de integração** com `mongodb-memory-server` (caminho
banco-acessível e banco-inacessível).

---

## Config loader — `src/config/load-config.ts`

```ts
export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  host: string;
  mongoUri: string;
  mongoDbName: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
}

/** Valida process.env com zod. Em falha: imprime os campos inválidos e chama process.exit(1). */
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig;
```

Registro Awilix: `config` (asValue, singleton).

---

## Mongo connection — `src/db/mongo-client.ts`

```ts
/** Cria o MongoClient (serverSelectionTimeoutMS curto). Não conecta. */
export function createMongoClient(config: AppConfig): MongoClient;

/** Tenta client.connect(); loga e segue em caso de falha (não lança). */
export async function connectMongo(client: MongoClient, logger: FastifyBaseLogger): Promise<void>;
```

Registro Awilix: `mongoClient` (singleton, com disposer `c => c.close()`), `db`
(`asFunction` → `mongoClient.db(config.mongoDbName)`).

---

## App factory — `src/app.ts`

```ts
/** Monta a instância Fastify: logger (LOG_LEVEL, reqId), @fastify/awilix + registros,
 *  error handler global, e o plugin de rotas de cada domínio. Não faz listen. */
export async function buildApp(config: AppConfig): Promise<FastifyInstance>;
```

## Entrypoint — `src/server.ts`

Lê `loadConfig`, `buildApp`, `connectMongo`, `app.listen`, registra handlers de
`SIGTERM`/`SIGINT` → `app.close()` (dispara disposers) → `process.exit(0)`.

---

## Route plugin — `src/controllers/health/health.routes.ts`

Plugin Fastify por domínio (RF-020). Registra `GET /health` apontando para o handler
`get-health.controller.ts`, que resolve `getHealthService` do container, chama-o e responde
`200`/`503` conforme `status`.
