# Fase 0 — Pesquisa: Backend App Setup

Feature: `001-backendappsetup` · Data: 2026-09-03

Toda a stack já foi decidida em `.specify/memory/architecture.md`. Esta pesquisa resolve
apenas as lacunas de **como** montar o setup dentro dessa stack. Nenhum `[NEEDS CLARIFICATION]`
restou do Contexto Técnico.

---

## D1 — Versões das dependências

**Decisão**: fixar com caret nas versões maiores atuais do registro:

| Pacote | Versão | Papel |
|---|---|---|
| `fastify` | `^5.12` | servidor HTTP |
| `awilix` | `^13.0` | container de DI |
| `@fastify/awilix` | `^8.2` | integração DI ↔ Fastify (disposers, escopo) |
| `mongodb` | `^7.6` | driver nativo |
| `zod` | `^4.5` | validação de schema |
| `migrate-mongo` | `^14.0` | infraestrutura de migrations |
| `vitest` | `^5.0` | runner de testes |
| `@vitest/coverage-v8` | `^5.0` | relatório/threshold de cobertura |
| `mongodb-memory-server` | `^11.2` | Mongo em memória para testes de integração |
| `tsx` | `^4.23` | execução TS em dev (`npm run dev` com watch) |
| `typescript` | `^7.0` | compilador (`npm run build`) — sobe do `^6.0.3` atual |
| `pino-pretty` | `^13.1` | logs legíveis em dev (pino já vem no Fastify) |
| `eslint` + `typescript-eslint` + `eslint-config-prettier` + `prettier` | atuais | lint/format |

**Justificativa**: são as majors vigentes e mutuamente compatíveis; todas publicam tipos e
funcionam em CommonJS. **Alternativas**: travar versões exatas — descartado, caret já dá
reprodutibilidade com o lockfile versionado.

---

## D2 — Módulo: CommonJS (mantido)

**Decisão**: manter `module: commonjs` do `tsconfig.json` atual. `migrate-mongo` e seu
config carregam em CJS; Fastify 5 e as demais libs suportam CJS sem ressalva.

**Justificativa**: evita fricção com o config do migrate-mongo e com o carregamento do
`eslint.config.js`. **Alternativas**: ESM (`"type": "module"`) — adiada; sem ganho para esta
feature e adiciona pontas soltas (extensões `.js` em imports, interop com migrate-mongo).

---

## D3 — Execução em dev e build

**Decisão**: `npm run dev` = `tsx watch src/server.ts`; `npm run build` = `tsc`; `npm start`
= `node dist/server.js`. `outDir: dist`, adicionar `rootDir: src`. Manter `module: commonjs`
e, coerente com isso, `moduleResolution: node10` (não `node16`, que exigiria `module`
`node16`/`nodenext`).

**Justificativa**: `tsx` é a forma mais rápida de rodar TS em watch sem etapa de build; `tsc`
continua sendo a fonte da verdade de checagem de tipos (RF-007). **Alternativas**: `ts-node`
(mais lento, ESM/CJS quirks); bundler (`tsup`/`esbuild`) — desnecessário para um serviço.

---

## D4 — Ciclo de vida da conexão MongoDB

**Decisão**: um único `MongoClient` criado no boot, registrado no Awilix como **singleton**
com `serverSelectionTimeoutMS` curto (ex.: 2000 ms). O boot chama `client.connect()`, mas
**falha de conexão não aborta o processo** — é logada e a aplicação sobe mesmo assim.
Config de ambiente inválida, essa sim, aborta (fail-fast).

**Justificativa**: casa com os cenários da spec — RF-010 (env inválida → não sobe) vs RF-019 /
casos de borda (Mongo fora → app no ar, `/health` responde `503`). **Alternativas**: abortar
se o Mongo não conectar no boot — viola RF-019; lazy-connect no primeiro uso — pior para
observabilidade e para o próprio health-check.

---

## D5 — Verificação de saúde do banco

**Decisão**: no `MongoHealthRepository`, executar `db.command({ ping: 1 })` com um
`AbortSignal.timeout(1000)`. Sucesso → `up`; qualquer erro/timeout → `down` (capturado,
convertido, nunca propaga exceção crua — P5 da constituição).

**Justificativa**: `ping` é o probe oficial, barato e não exige coleção (coerente com "sem
migration de dados"). **Alternativas**: inspecionar `client.topology` — API interna instável;
fazer um `findOne` numa coleção — exigiria coleção e migration.

---

## D6 — Awilix + Fastify

**Decisão**: `@fastify/awilix` com `injectionMode: 'PROXY'`, container por aplicação
(`asFunction` para services e repositories, `asValue`/`asFunction` singleton para
`mongoClient` e `db`). Disposer registrado no `mongoClient` para fechar no shutdown. Cada
factory de operação segue `makeXxx = ({ dep }) => async (input) => {...}`.

**Justificativa**: é o padrão do plugin oficial e já definido em `architecture.md`; disposers
dão o fechamento de conexão no `app.close()` de graça. **Alternativas**: escopo por request —
sem necessidade agora (nenhum estado per-request); DI manual — `architecture.md` já decidiu
por lib.

---

## D7 — Correlação de logs (`request-id`)

**Decisão**: configurar Fastify com `requestIdHeader: 'x-request-id'` e `genReqId` gerando
um UUID quando o header não vem; o logger do Fastify já anexa `reqId` a todo log de
requisição. `LOG_LEVEL` vindo da config alimenta `logger.level`. Em dev, transport
`pino-pretty`; em produção, JSON puro.

**Justificativa**: atende RF-014 sem dependência extra. **Alternativas**: `@fastify/request-context`
+ AsyncLocalStorage — útil quando serviços logam fora do ciclo da request; adiável.

---

## D8 — Encerramento gracioso

**Decisão**: extrair `registerShutdownHandlers(app, { timeoutMs = 10_000 })` para
`src/lifecycle/graceful-shutdown.ts` (testável em unidade): registra `SIGTERM`/`SIGINT`,
chama `app.close()` **uma única vez** (guarda contra sinal repetido), depois `process.exit(0)`;
timeout de segurança força a saída. `app.close()` para de aceitar conexões, drena as em
andamento e dispara os disposers do Awilix (fecha o `MongoClient`). `server.ts` só chama
`registerShutdownHandlers(app)` após o `listen`.

**Justificativa**: atende RF-015 sem plugin e de forma verificável (teste de sinal repetido);
`app.close()` do Fastify já faz a drenagem; o teste de integração `app/shutdown.spec.ts`
cobre a ponta "disposer fecha o Mongo". **Alternativas**: manter tudo inline no `server.ts` —
não testável; `close-with-grace` / `@fastify/graceful-shutdown` — dependência a mais para
~20 linhas.

---

## D9 — Gate de cobertura das regras de negócio

**Decisão**: cobertura com `@vitest/coverage-v8`, coletada na execução combinada das duas
suítes. `coverage.thresholds` com escopo por glob:

```
thresholds: {
  'src/services/**': { statements: 70, branches: 70, functions: 70, lines: 70 }
}
```

CI roda `npm run test:coverage` e falha se o threshold não for atingido (RF-033).

**Justificativa**: aplica o piso exatamente onde a constituição manda (regra de negócio =
`services/`), sem penalizar código de borda. **Alternativas**: threshold global de 70% —
menos fiel; gate só informativo — o usuário pediu gate que quebra o CI.

---

## D10 — Lint como cerca das convenções

**Decisão**: ESLint flat config (`eslint.config.js`, CJS) com `typescript-eslint` (recommended
type-checked) + `eslint-config-prettier`. Regras que tornam as convenções verificáveis:

- `no-restricted-syntax` barrando `ExportDefaultDeclaration` (proíbe `export default` — RF-002).
- `no-restricted-imports` barrando `mongodb` fora de `src/repositories/**` e `src/db/**`
  (P2 da constituição / padrão de `architecture.md`).
- `@typescript-eslint/no-explicit-any` como erro.

`tsconfig.eslint.json` estende o base incluindo `tests/` para o lint type-checked.

**Justificativa**: a constituição exige regras "verificáveis", não só documentadas.
**Alternativas**: só Prettier + convenção escrita — rejeitado.

---

## D11 — Config do migrate-mongo

**Decisão**: `migrate-mongo-config.js` (CJS) lendo `MONGO_URI` e `MONGO_DB_NAME` do ambiente,
`migrationsDir: 'migrations'`, `changelogCollectionName: 'changelog'`, `moduleSystem: 'commonjs'`.
Scripts npm: `migrate:up`, `migrate:down`, `migrate:create`. Pasta `migrations/` criada com um
`.gitkeep` — **nenhuma migration** nesta feature.

**Justificativa**: atende RF-008 (só infra). **Alternativas**: gerar uma migration de exemplo
no-op — contradiz a decisão registrada na spec.

---

## D12 — docker-compose do Mongo local

**Decisão**: `docker-compose.yml` com serviço `mongo` (imagem `mongo:7`), porta publicada
`${MONGO_PORT:-27017}:27017`, volume nomeado `mongo-data`, `healthcheck` com `mongosh --eval
"db.adminCommand('ping')"`. O `.env.example` traz `MONGO_URI=mongodb://localhost:27017` e
`MONGO_DB_NAME=better_books`.

**Justificativa**: atende RF-029; imagem major alinhada ao driver `^7`. **Alternativas**:
replica set de 1 nó (necessário para transações) — fora de escopo desta feature.

---

## Telas de design

N/A — não existe pasta `design/` e a feature não tem UI.

## Impacto na constituição

Nenhuma decisão de design viola um princípio. Ver "Verificação da Constituição" no `plan.md`
(rodada inicial e pós-Fase 1, ambas aprovadas). "Rastreio de Complexidade" fica vazio.
