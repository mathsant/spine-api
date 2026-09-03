# Tarefas: Backend App Setup

**Entrada**: `plan.md`, `data-model.md`, `contracts/`, `quickstart.md` de `specs/001-backendappsetup/`
**Convenção**: `[P]` = pode rodar em paralelo (arquivos diferentes, sem dependência entre si). Sem `[P]` = sequencial.

Caminhos seguem a tabela "Onde cada tipo de código novo deve ir" de `.specify/memory/architecture.md`.
Cada tarefa que cria arquivos numa pasta de domínio também cria/atualiza o `index.ts` de re-export dessa pasta (exports nomeados, nunca `export default`).

Fases (cada uma é um marco entregável):

1. **Bootstrap do projeto** — toolchain, configs e estrutura; nenhum código de aplicação. Marco: `npm install`, `npm run build`, `npm run lint` e `npm test` executam sobre a estrutura definida.
2. **Núcleo transversal** — erros tipados, config com fail-fast, conexão Mongo, error handler HTTP, base do container. Marco: config inválida derruba o boot, envelope de erro definido, container de infraestrutura monta.
3. **Fatia vertical `health`** — `GET /health` ponta a ponta (controller → service → repository) em ordem TDD. Marco: `app.inject('/health')` responde 200/503; testes de integração verdes com `mongodb-memory-server`.
4. **Ciclo de vida do processo** — `app.ts`/`server.ts`, `connectMongo`, encerramento gracioso testável fechando a conexão. Marco: processo real sobe, serve e encerra fechando o Mongo.
5. **CI e documentação** — GitHub Actions, README, execução do `quickstart.md`. Marco: Definição de Pronto toda verificável e CI verde.

---

## Fase 1: Bootstrap do projeto

- [x] T001 Preencher `package.json`: `dependencies` (`fastify`, `awilix`, `@fastify/awilix`, `mongodb`, `zod`), `devDependencies` (`typescript`, `tsx`, `vitest`, `@vitest/coverage-v8`, `mongodb-memory-server`, `migrate-mongo`, `eslint`, `typescript-eslint`, `eslint-config-prettier`, `prettier`, `pino-pretty`, `@types/node`), `scripts` (`dev`, `build`, `start`, `test`, `test:unit`, `test:integration`, `test:coverage`, `lint`, `format`, `migrate:up`, `migrate:down`, `migrate:create`) e `engines` (`"node": ">=24 <25"`); rodar `npm install`. O script `test:coverage` DEVE rodar **as duas suítes** (unit + integration) com cobertura agregada num único relatório (ex.: `vitest run --coverage`, que executa todos os projects). Arquivo: `package.json`
- [x] T002 [P] Criar `.nvmrc` com `24`. Arquivo: `.nvmrc`
- [x] T003 [P] Ajustar `tsconfig.json`: adicionar `rootDir: "src"`, `sourceMap: true`, `resolveJsonModule: true`, `declaration: false` e `moduleResolution: "node10"` (mantendo `module: "commonjs"` — não usar `node16`). Arquivo: `tsconfig.json`
- [x] T004 [P] Criar `tsconfig.eslint.json` estendendo `tsconfig.json` e com `include` cobrindo `src`, `tests` e os arquivos de config `.js`/`.ts` da raiz. Arquivo: `tsconfig.eslint.json`
- [x] T005 [P] Criar `eslint.config.js` (flat config, CommonJS): `typescript-eslint` recommended-type-checked + `eslint-config-prettier`; regras que tornam as convenções verificáveis — `no-restricted-syntax` barrando `ExportDefaultDeclaration` (RF-002); `no-restricted-imports` barrando o pacote `mongodb` fora de `src/repositories/**` e `src/db/**` (RF-028); `no-process-env` (ou `no-restricted-properties` sobre `process.env`) permitido apenas em `src/config/**`, `src/server.ts` e nos arquivos de config da raiz (RF-012); `@typescript-eslint/no-explicit-any` como `error`. Arquivo: `eslint.config.js`
- [x] T006 [P] Criar `.prettierrc.json` e `.prettierignore`. Arquivos: `.prettierrc.json`, `.prettierignore`
- [x] T007 [P] Criar `vitest.config.ts`: dois projects (`unit` → `tests/unit/**/*.spec.ts`, `integration` → `tests/integration/**/*.spec.ts`); `coverage` com provider `v8`, `include: ['src/**']`, coletando de **ambos os projects** numa execução, e `thresholds` no glob `src/services/**` em 70% (statements/branches/functions/lines) — a cobertura das regras de negócio vem majoritariamente da suíte de integração, então o relatório precisa agregá-la. Arquivo: `vitest.config.ts`
- [x] T008 [P] Criar `docker-compose.yml`: serviço `mongo` (imagem `mongo:7`), porta `${MONGO_PORT:-27017}:27017`, volume nomeado `mongo-data`, `healthcheck` com `mongosh --eval "db.adminCommand('ping')"`. Arquivo: `docker-compose.yml`
- [x] T009 [P] Criar `.env.example` conforme `contracts/env.contract.md` (`NODE_ENV`, `PORT`, `HOST`, `MONGO_URI`, `MONGO_DB_NAME`, `LOG_LEVEL` + `MONGO_PORT` comentado). Arquivo: `.env.example`
- [x] T010 [P] Criar `migrate-mongo-config.js` (CommonJS) lendo `MONGO_URI`/`MONGO_DB_NAME` do ambiente, `migrationsDir: 'migrations'`, `changelogCollectionName: 'changelog'`, `moduleSystem: 'commonjs'`; criar `migrations/.gitkeep`. Arquivos: `migrate-mongo-config.js`, `migrations/.gitkeep`
- [x] T011 [P] Remover `src/index.ts` (vazio) e criar `src/schemas/.gitkeep` (camada da `architecture.md` sem código nesta feature — a fatia `health` não recebe entrada; RF-001). Arquivos: `src/index.ts`, `src/schemas/.gitkeep`

## Fase 2: Núcleo transversal

- [x] T012 Criar classe base abstrata `AppError` (campos `code`, `message`, `statusCode`, `details?`, `isOperational = true`) estendendo `Error`. Arquivo: `src/errors/app-error.ts`
- [x] T013 [P] Criar `ValidationError extends AppError` (`code: 'VALIDATION_ERROR'`, `statusCode: 400`, `details` = issues achatadas de um `ZodError`) com um factory `fromZodError(err)`. Arquivo: `src/errors/validation-error.ts` (depende de T012)
- [x] T014 [P] Criar `NotFoundError extends AppError` (`code: 'NOT_FOUND'`, `statusCode: 404`). Arquivo: `src/errors/not-found-error.ts` (depende de T012)
- [x] T015 [P] Criar `DatabaseUnavailableError extends AppError` (`code: 'DATABASE_UNAVAILABLE'`, `statusCode: 503`). Arquivo: `src/errors/database-unavailable-error.ts` (depende de T012)
- [x] T016 Criar `src/errors/index.ts` reexportando `AppError`, `ValidationError`, `NotFoundError`, `DatabaseUnavailableError`. Arquivo: `src/errors/index.ts` (depende de T012–T015)
- [x] T017 [P] Escrever teste unitário do carregador de config (TDD): env válido → `AppConfig` com defaults aplicados; `MONGO_URI` ausente → `process.exit(1)` e mensagem citando o campo; `PORT` não-numérico → inválido. Arquivo: `tests/unit/config/load-config.spec.ts`
- [x] T018 Criar o schema `zod` das variáveis de ambiente conforme `contracts/env.contract.md`; exportar `type AppConfig = z.infer<typeof envSchema>`. Arquivo: `src/config/env.schema.ts`
- [x] T019 Criar `loadConfig(env: NodeJS.ProcessEnv): AppConfig` que valida com `envSchema`, e em erro imprime cada issue e chama `process.exit(1)`. Arquivo: `src/config/load-config.ts` (depende de T018; faz T017 passar)
- [x] T020 Criar `src/config/index.ts` reexportando `loadConfig`, `envSchema`, `AppConfig`. Arquivo: `src/config/index.ts` (depende de T018–T019)
- [x] T021 [P] Escrever teste unitário do error handler (TDD): `AppError` → envelope com o `statusCode` do erro; `ZodError` → `400` com `details`; `Error` genérico → `500` com corpo `{ error: { code: 'INTERNAL_ERROR', ... } }` e sem `stack`/mensagem interna. Arquivo: `tests/unit/http/error-handler.spec.ts` (depende de T016)
- [x] T022 Criar `ErrorResponse` (tipo do envelope) e `toErrorResponse(err: AppError): ErrorResponse` conforme `contracts/error-response.schema.json`. Arquivo: `src/http/error-response.ts` (depende de T016)
- [x] T023 Criar `registerErrorHandler(app: FastifyInstance)` usando `app.setErrorHandler`: `instanceof AppError` → `toErrorResponse`; `ZodError` → `ValidationError.fromZodError`; senão logar o erro completo e responder `500` `{ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error', statusCode: 500 } }` (sem classe `InternalError` — é literal). Arquivo: `src/http/error-handler.ts` (depende de T022, T013; faz T021 passar)
- [x] T024 Criar `src/http/index.ts` reexportando `registerErrorHandler`, `ErrorResponse`, `toErrorResponse`. Arquivo: `src/http/index.ts` (depende de T022–T023)
- [x] T025 [P] Criar `createMongoClient(config: AppConfig): MongoClient` (`serverSelectionTimeoutMS: 2000`, sem conectar) e `connectMongo(client, logger): Promise<void>` (tenta `client.connect()`, captura e loga o erro, **não lança**). Arquivo: `src/db/mongo-client.ts`
- [x] T026 Criar `src/db/index.ts` reexportando `createMongoClient`, `connectMongo`. Arquivo: `src/db/index.ts` (depende de T025)
- [x] T027 Criar `registerInfrastructure(container)` (Awilix): `config` (`asValue`), `mongoClient` (`asFunction`, singleton, disposer `(c) => c.close()`), `db` (`asFunction` → `mongoClient.db(config.mongoDbName)`, singleton). Arquivo: `src/container/register-infrastructure.ts` (depende de T020, T026)

## Fase 3: Fatia vertical `health` (TDD)

- [x] T028 Criar helper de teste que sobe/derruba uma instância `mongodb-memory-server` e devolve a URI. Arquivo: `tests/helpers/mongo-memory.ts`
- [x] T029 Escrever teste de integração do `get-health` service (TDD): com Mongo em memória real → `{ status: 'ok', db: 'up', uptime >= 0 }`; com o servidor parado/URI inacessível → `{ status: 'degraded', db: 'down' }`; cobre RF-018/RF-019 e os cenários de aceitação 2 e 3. Arquivo: `tests/integration/services/health/get-health.service.spec.ts` (depende de T028)
- [x] T030 Criar a interface `HealthRepository { ping(): Promise<boolean> }` conforme `contracts/internal-ports.md`, com `src/repositories/health/index.ts`. Arquivo: `src/repositories/health/health.repository.ts`
- [x] T031 Criar `MongoHealthRepository` implementando `HealthRepository`: `db.command({ ping: 1 })` com `AbortSignal.timeout(1000)`; qualquer erro/timeout é capturado e convertido (retorna `false`, nunca propaga exceção crua do driver — P5). Arquivo: `src/repositories/health/mongo-health.repository.ts` (depende de T030, T015, T026)
- [x] T032 Criar `registerRepositories(container)` registrando `healthRepository` (`asFunction`, singleton). Arquivo: `src/container/register-repositories.ts` (depende de T031)
- [x] T033 [P] Escrever teste unitário do `get-health` service (TDD) com um `HealthRepository` fake: `ping` `true` → `status: 'ok'`/`db: 'up'`; `ping` `false` → `status: 'degraded'`/`db: 'down'`; `uptime` é inteiro `>= 0`. Arquivo: `tests/unit/services/health/get-health.service.spec.ts` (depende de T030)
- [x] T034 Criar `makeGetHealth({ healthRepository }): GetHealth` que compõe `HealthStatus` a partir de `ping()` e `process.uptime()` truncado, com `src/services/health/index.ts`. Arquivo: `src/services/health/get-health.service.ts` (depende de T030; faz T029 e T033 passarem)
- [x] T035 Criar `registerServices(container)` registrando `getHealthService` (`asFunction`). Arquivo: `src/container/register-services.ts` (depende de T034)
- [x] T036 Escrever teste de integração da rota `GET /health` (TDD) com `buildApp` + `app.inject`: Mongo em memória → `200` com corpo conforme `contracts/health.openapi.yaml`; Mongo indisponível → `503`; valida o invariante status↔db↔HTTP; e valida que um `x-request-id` enviado no request aparece na resposta/log da requisição (RF-014). Arquivo: `tests/integration/http/health.routes.spec.ts` (depende de T028; passa após T040)
- [x] T037 Criar o handler `getHealthController` que resolve `getHealthService` do cradle da request, chama-o e responde `200` (`status: 'ok'`) ou `503` (`status: 'degraded'`). Arquivo: `src/controllers/health/get-health.controller.ts` (depende de T034)
- [x] T038 Criar o plugin de rotas do domínio registrando `GET /health` → `getHealthController`, com `src/controllers/health/index.ts`. Arquivo: `src/controllers/health/health.routes.ts` (depende de T037)
- [x] T039 Criar `registerContainer(app)` combinando `registerInfrastructure` + `registerRepositories` + `registerServices` sobre o container do `@fastify/awilix`. Arquivo: `src/container/index.ts` (depende de T027, T032, T035)
- [x] T040 Criar `buildApp(config: AppConfig): Promise<FastifyInstance>`: instancia o Fastify com logger no nível `config.logLevel` (transport `pino-pretty` fora de produção), `requestIdHeader: 'x-request-id'` e `genReqId` gerando UUID quando o cabeçalho não vem; registra `@fastify/awilix`, `registerContainer`, `registerErrorHandler` e o plugin `healthRoutes`. Arquivo: `src/app.ts` (depende de T039, T024, T038; faz T036 passar)

## Fase 4: Ciclo de vida do processo

- [x] T041 [P] Escrever teste unitário do encerramento gracioso (TDD): emitir `SIGTERM` chama o callback de fechamento **uma vez**; um segundo `SIGTERM` durante o encerramento é ignorado; o timeout de segurança força a saída. Usa um `app` fake com `close()` espião. Arquivo: `tests/unit/lifecycle/graceful-shutdown.spec.ts`
- [x] T042 Criar `registerShutdownHandlers(app, { timeoutMs = 10_000 })` em `src/lifecycle/graceful-shutdown.ts` (com `index.ts`): registra `SIGTERM`/`SIGINT`, chama `app.close()` uma única vez (guarda de sinal repetido) e depois `process.exit(0)`; timeout de segurança força a saída. Arquivo: `src/lifecycle/graceful-shutdown.ts` (depende de nada além da Fase 1; faz T041 passar)
- [x] T043 Escrever teste de integração do encerramento no nível da aplicação (TDD): `buildApp` com Mongo em memória → `await app.close()` resolve e o `MongoClient` fica fechado (disposer do Awilix disparou); cobre o cenário de aceitação 7. Arquivo: `tests/integration/app/shutdown.spec.ts` (depende de T028, T040)
- [x] T044 Criar o entrypoint: `loadConfig(process.env)` → `buildApp` → `connectMongo(container.resolve('mongoClient'), app.log)` → `app.listen({ port, host })` → `registerShutdownHandlers(app)`. Arquivo: `src/server.ts` (depende de T040, T042, T025; confirma T043 quanto ao disposer)

## Fase 5: CI e documentação

- [x] T045 [P] Criar o workflow de CI: em `push` e `pull_request`, `actions/setup-node` com Node 24, `npm ci`, depois `npm run lint` → `npm run test:unit` → `npm run test:integration` → `npm run build`; passo `npm run test:coverage` (agrega unit + integration) que falha se a cobertura de `src/services/**` ficar abaixo de 70% (RF-031/032/033). Arquivo: `.github/workflows/ci.yml`
- [x] T046 [P] Criar o `README.md` com os passos do `quickstart.md`: subir o Mongo via `docker compose`, instalar, configurar `.env`, `npm run dev`, rodar testes e lint, comandos de migration, e o que o CI valida (RF-030). Arquivo: `README.md`
- [x] T047 [P] Rodar `npm run lint`, `npm run test:coverage` e `npm run build`; conferir `grep -rn "export default" src` vazio, um `index.ts` em cada pasta de domínio e `src/schemas/` presente; sanar o que falhar. Sem arquivo fixo (ajustes pontuais onde o comando apontar)
- [x] T048 Executar `specs/001-backendappsetup/quickstart.md` de ponta a ponta e marcar cada item da "Definição de Pronto" no `spec.md`. Arquivo: `specs/001-backendappsetup/spec.md`

---

## Dependências

- **Fase 1 → todas**: sem `package.json`/configs, nada compila nem testa.
- **Fase 2 → Fase 3**: `errors`, `config`, `http` (error handler) e `db` são pré-requisito da fatia `health` e do `buildApp`.
- **Fase 3 → Fase 4**: `buildApp` (T040) é pré-requisito de `server.ts` (T044) e do teste de encerramento no nível da app (T043). `graceful-shutdown` (T041/T042) só depende da Fase 1 e pode ser feito em paralelo com a Fase 3.
- **Fases 1–4 → Fase 5**: o CI (T045) chama scripts que só existem após a Fase 1; o `quickstart` (T048) exige a feature inteira.
- Internas relevantes:
  - T012 → T013, T014, T015 → T016
  - T018 → T019 → T020; T017 (teste) precede T019
  - T016 → T022 → T023 → T024; T021 (teste) precede T023
  - T025 → T026 → T027
  - T028 → T029, T033, T036, T043 (testes)
  - T030 → T031 → T032; T030 → T034 → T035; T034 → T037 → T038
  - T027 + T032 + T035 → T039 → T040
  - T024 + T038 + T039 → T040
  - T041 (teste) precede T042; T040 + T042 → T044; T040 → T043

## Exemplo de execução em paralelo

```
# Fase 1 — após T001 (package.json + npm install), tudo isto toca arquivos distintos:
T002 .nvmrc | T003 tsconfig.json | T004 tsconfig.eslint.json | T005 eslint.config.js
T006 .prettierrc.json | T007 vitest.config.ts | T008 docker-compose.yml
T009 .env.example | T010 migrate-mongo-config.js | T011 remover src/index.ts + src/schemas/.gitkeep

# Fase 2 — após T012, as três subclasses de erro em paralelo:
T013 src/errors/validation-error.ts
T014 src/errors/not-found-error.ts
T015 src/errors/database-unavailable-error.ts

# Fase 2 — testes de núcleo em paralelo (arquivos de teste distintos):
T017 tests/unit/config/load-config.spec.ts
T021 tests/unit/http/error-handler.spec.ts

# Fase 4 — graceful-shutdown corre em paralelo à Fase 3 (só depende da Fase 1):
T041 tests/unit/lifecycle/graceful-shutdown.spec.ts → T042 src/lifecycle/graceful-shutdown.ts

# Fase 5 — independentes entre si:
T045 .github/workflows/ci.yml | T046 README.md | T047 checagens de lint/cobertura
```

## Notas

- `src/http/`, `src/lifecycle/` e a pasta de teste `tests/integration/app/` não constam explicitamente em `architecture.md`, mas seguem a organização por camada (tradução erro↔HTTP, handlers de sinal do processo, teste no nível da aplicação) — coerente com o registrado no `plan.md`.
- Ordem TDD: T017→T019, T021→T023, T029/T033→T034, T036→T040, T041→T042 (o teste é escrito e falha antes da implementação que o satisfaz).
- `INTERNAL_ERROR` é `code` literal do corpo genérico de erro não tratado — não há classe na hierarquia (ver `data-model.md`).
- Commitar após cada tarefa concluída.
- Toda pasta de domínio termina com `index.ts` de re-export nomeado; nenhum `export default` em nenhum arquivo (cercado pela regra de ESLint em T005).
- `mongodb` só pode ser importado em `src/repositories/**` e `src/db/**`; `process.env` só em `src/config/**`, `src/server.ts` e configs da raiz (ambos cercados por ESLint em T005).
