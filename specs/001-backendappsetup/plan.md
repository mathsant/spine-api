# Plano de Implementação: Backend App Setup

**Branch**: `001-backendappsetup` | **Data**: 2026-09-03 | **Spec**: [spec.md](./spec.md)
**Entrada**: especificação de feature em `specs/001-backendappsetup/spec.md`

## Resumo

Montar o esqueleto do backend monolito em camadas (`controller → service → repository`) já
definido em `.specify/memory/architecture.md`: estrutura de pastas com `index.ts` de
re-export e sem `export default`, dependências instaladas e fixadas, config validada por
`zod` com fail-fast, conexão MongoDB via Awilix, error handler global com envelope único,
logging com `request-id`, encerramento gracioso, infraestrutura de migrations (sem
migration de dados), `docker-compose` para o Mongo local, e uma fatia vertical de
referência `health` (`GET /health`) completa e testada (unitário + integração com
`mongodb-memory-server`). Pipeline de CI no GitHub Actions com gate de cobertura de 70%
sobre `src/services/**`.

Abordagem técnica: ver Fase 0 (`research.md`) — decisões D1–D12.

## Contexto Técnico

<!-- Esta seção é lida pelo update-agent-context.sh para atualizar o CLAUDE.md do projeto. -->

**Linguagem/versão**: TypeScript ~7.x (strict, `module: commonjs`) sobre Node.js v24
**Dependências principais**: Fastify ^5.12, Awilix ^13 + @fastify/awilix ^8.2, mongodb ^7.6 (driver nativo), zod ^4.5
**Armazenamento**: MongoDB — local via `docker-compose` (`mongo:7`); `mongodb-memory-server` ^11 nos testes de integração; sem migration de dados nesta feature
**Testes**: Vitest ^5 + @vitest/coverage-v8 ^5; dois projects (`unit`, `integration`); `mongodb-memory-server` para regra de negócio
**Ferramentas**: migrate-mongo ^14 (só infra), ESLint flat + typescript-eslint + Prettier, tsx ^4 (dev), pino (embutido no Fastify) + pino-pretty (dev)
**Plataforma-alvo**: servidor Node.js (container Linux)
**Tipo de projeto**: single (backend monolito em camadas)
**Metas de performance**: N/A (feature de setup); `GET /health` deve responder mesmo com o banco fora, `ping` com timeout de 1 s
**Restrições**: fail-fast em config inválida; nenhuma exceção crua do driver além do repository; cobertura de `src/services/**` ≥ 70% quebra o CI; nenhum `export default`; `mongodb` só importável em `repositories/**` e `db/**`
**Escala/escopo**: 1 endpoint (`GET /health`), 3 entidades conceituais (AppConfig, HealthStatus, hierarquia AppError), ~8 pastas de camada

## Verificação da Constituição

*Gate obrigatório: rodado antes da Fase 0 e novamente após a Fase 1. Consulte `.specify/memory/constitution.md`.*

Marque cada princípio como conforme ou aponte a violação. Toda violação exige justificativa na seção "Rastreio de Complexidade" abaixo — não prossiga silenciosamente.

- [x] **Idioma do código: inglês** — toda pasta/arquivo/identificador/contrato do plano está em inglês; artefatos SDD seguem em português.
- [x] **P1 Testes por tipo de código** — `health` service (regra de negócio) coberto por teste de **integração** com `mongodb-memory-server`, sem mockar o banco, nos dois caminhos (db up / db down); `loadConfig`, mapeamento de erro, `HealthStatus` composer e demais funções puras cobertos por **unitário**. Gate de cobertura de `src/services/**` ≥ 70% no CI. Conforme.
- [x] **P2 Acesso a dados só via repositório** — `HealthRepository` (interface) + `MongoHealthRepository` (implementação), injetados por Awilix; regra ESLint barra `import 'mongodb'` fora de `repositories/**` e `db/**`. Conforme.
- [x] **P3 Validação de entrada com Zod na borda** — `AppConfig` validado por schema `zod` no boot; error handler global traduz `ZodError` → `ValidationError` (400, com `details`). `GET /health` não recebe input do usuário, então o padrão fica exercitado pelo config schema e pelo handler; features seguintes validam seus payloads no controller. Conforme.
- [x] **P4 Mudança de schema/índice apenas via migration** — infraestrutura `migrate-mongo` entregue; **nenhuma** criação de coleção/índice nesta feature (health usa `ping`). Nada criado "no ar". Conforme.
- [x] **P5 Erros tipados com hierarquia** — `AppError` base + `ValidationError`/`NotFoundError`/`DatabaseUnavailableError`; o repository captura exceção crua do driver e converte; error handler mapeia `instanceof AppError` e manda qualquer outra coisa para `500` genérico. Conforme.

Resultado: **sem violações** nas duas rodadas (inicial e pós-Fase 1). "Rastreio de Complexidade" vazio.

## Estrutura do Projeto

### Documentos desta feature (`specs/001-backendappsetup/`)

```
specs/001-backendappsetup/
├── spec.md
├── plan.md              # este arquivo
├── research.md          # Fase 0 — decisões D1–D12
├── data-model.md        # Fase 1 — AppConfig, HealthStatus, hierarquia AppError
├── quickstart.md        # Fase 1 — validação manual (11 passos)
├── contracts/           # Fase 1
│   ├── health.openapi.yaml
│   ├── error-response.schema.json
│   ├── internal-ports.md
│   └── env.contract.md
└── tasks.md             # Fase 2 — gerado pelo /tasks, não por este comando
```

### Código-fonte (raiz do repositório)

Segue a tabela "Onde cada tipo de código novo deve ir" de `.specify/memory/architecture.md`.
Arquivos que esta feature cria:

```
better-books/
├── src/
│   ├── server.ts                        # entrypoint: loadConfig, buildApp, connectMongo, listen, registerShutdownHandlers
│   ├── app.ts                           # buildApp(): Fastify + logger(reqId, x-request-id) + awilix + error handler + rotas
│   ├── lifecycle/
│   │   ├── graceful-shutdown.ts         # registerShutdownHandlers(app): SIGTERM/SIGINT -> app.close() (guarda de sinal repetido)
│   │   └── index.ts
│   ├── config/
│   │   ├── env.schema.ts                # schema zod das variáveis de ambiente
│   │   ├── load-config.ts               # loadConfig(env): AppConfig | process.exit(1)
│   │   └── index.ts
│   ├── container/
│   │   ├── register-infrastructure.ts   # mongoClient (disposer), db, config
│   │   ├── register-repositories.ts     # healthRepository
│   │   ├── register-services.ts         # getHealthService
│   │   └── index.ts                     # registerContainer(app)
│   ├── db/
│   │   ├── mongo-client.ts              # createMongoClient, connectMongo (não lança)
│   │   └── index.ts
│   ├── errors/
│   │   ├── app-error.ts                 # classe base abstrata
│   │   ├── validation-error.ts          # 400 VALIDATION_ERROR (+details)
│   │   ├── not-found-error.ts           # 404 NOT_FOUND
│   │   ├── database-unavailable-error.ts# 503 DATABASE_UNAVAILABLE
│   │   └── index.ts
│   ├── http/
│   │   ├── error-handler.ts             # setErrorHandler: AppError | ZodError | genérico 500
│   │   ├── error-response.ts            # tipo/serializador do envelope { error: {...} }
│   │   └── index.ts
│   ├── controllers/
│   │   └── health/
│   │       ├── health.routes.ts         # plugin Fastify do domínio: GET /health
│   │       ├── get-health.controller.ts # handler: resolve getHealthService, responde 200/503
│   │       └── index.ts
│   ├── schemas/.gitkeep                 # camada sem código nesta feature (health não tem input) — marcador
│   ├── services/
│   │   └── health/
│   │       ├── get-health.service.ts    # makeGetHealth({ healthRepository }) -> HealthStatus
│   │       └── index.ts
│   └── repositories/
│       └── health/
│           ├── health.repository.ts     # interface HealthRepository { ping(): Promise<boolean> }
│           ├── mongo-health.repository.ts# implementação (db.command({ ping: 1 }) + timeout)
│           └── index.ts
├── tests/
│   ├── helpers/
│   │   └── mongo-memory.ts              # sobe/derruba mongodb-memory-server para a suíte de integração
│   ├── unit/
│   │   ├── config/load-config.spec.ts
│   │   ├── http/error-handler.spec.ts
│   │   ├── lifecycle/graceful-shutdown.spec.ts          # sinal dispara close uma vez; sinal repetido é ignorado
│   │   └── services/health/get-health.service.spec.ts   # com fake HealthRepository (função pura de composição)
│   └── integration/
│       ├── services/health/get-health.service.spec.ts   # mongodb-memory-server: db up / db down
│       ├── app/shutdown.spec.ts                         # buildApp + app.close() fecha o MongoClient (disposer Awilix)
│       └── http/health.routes.spec.ts                   # app.inject() GET /health 200/503 + x-request-id propagado
├── migrations/.gitkeep
├── .github/workflows/ci.yml
├── docker-compose.yml
├── .env.example
├── .nvmrc
├── eslint.config.js
├── .prettierrc.json
├── migrate-mongo-config.js
├── vitest.config.ts
├── tsconfig.json                        # + rootDir, sourceMap, moduleResolution: node10 (mantém module: commonjs)
├── tsconfig.eslint.json                 # inclui tests/ para lint type-checked
└── package.json                         # scripts + engines + deps
```

> `src/http/` e `src/lifecycle/` não estão listados explicitamente em `architecture.md` mas
> são coerentes com "organização por camada": concentram, respectivamente, a tradução
> erro↔HTTP consumida pelo `app.ts` e o registro de handlers de sinal do processo. Não são
> camadas de domínio; não recebem subpastas por domínio. `tests/integration/app/` segue a
> mesma lógica (teste no nível da aplicação montada).

## Fase 0: Pesquisa

Concluída — ver [research.md](./research.md). Nenhum `[NEEDS CLARIFICATION]` remanescente
(stack fixada por `architecture.md`; comportamento fixado pela spec + esclarecimentos).
Decisões: D1 versões · D2 CommonJS mantido · D3 tsx/tsc · D4 lifecycle da conexão (env
fail-fast, mongo não) · D5 `ping` com timeout · D6 Awilix/Fastify · D7 request-id · D8
shutdown manual · D9 gate de cobertura por glob · D10 ESLint como cerca · D11 migrate-mongo
config · D12 docker-compose.

**Saída**: `research.md`.

## Fase 1: Design & Contratos

Concluída.

1. `data-model.md` — `AppConfig`, `HealthStatus`, hierarquia `AppError` + envelope de erro.
2. `contracts/` — `health.openapi.yaml` (GET /health 200/503), `error-response.schema.json`
   (envelope único), `internal-ports.md` (interfaces entre camadas), `env.contract.md`
   (variáveis de ambiente + `.env.example` alvo).
3. Cenários de teste extraídos dos cenários de aceitação da spec → mapeados em
   `tests/unit/**` e `tests/integration/**` na Estrutura do Projeto acima.
4. `quickstart.md` — 11 passos cobrindo cada item da Definição de Pronto.
5. Design/telas: N/A (sem `design/`, sem UI).
6. `update-agent-context.sh` — executado para propagar a stack ao `CLAUDE.md`.

**Saída**: `data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md` atualizado.

## Fase 2: Abordagem de Planejamento de Tarefas

*Descrição do que o `/tasks` fará — não executar agora.*

**Estratégia de geração de tarefas**:
- Carregar `.specify/templates/tasks-template.md` como base.
- **Bloco A — bootstrap do projeto** (sequencial, precede tudo): `package.json` (deps +
  scripts + `engines`), `.nvmrc`, `tsconfig` (ajustes + `tsconfig.eslint.json`),
  `eslint.config.js` + `.prettierrc.json`, `vitest.config.ts` (dois projects + thresholds),
  `docker-compose.yml`, `.env.example`, `migrate-mongo-config.js` + `migrations/.gitkeep`.
- **Bloco B — núcleo transversal** (após A; vários `[P]` entre si): `errors/*` (uma tarefa
  por classe, `[P]`), `config/*` (schema + loader), `db/mongo-client.ts`, `http/error-*`,
  `container/*`.
- **Bloco C — fatia `health` em ordem TDD**: (1) teste de integração do `get-health.service`
  (db up / db down) → (2) `health.repository.ts` interface + `mongo-health.repository.ts` →
  (3) `get-health.service.ts` → (4) teste `app.inject()` de `health.routes` (200/503) →
  (5) `get-health.controller.ts` + `health.routes.ts`.
- **Bloco D — composição e ciclo de vida**: `app.ts` (wire logger/reqId `x-request-id` +
  awilix + error handler + rotas), `lifecycle/graceful-shutdown.ts` (registro testável dos
  handlers de sinal, com teste unitário antes), `server.ts` (listen + connectMongo +
  `registerShutdownHandlers`), teste de integração `app/shutdown.spec.ts` (disposer fecha o
  MongoClient), remover o `src/index.ts` atual (vazio) e criar `src/schemas/.gitkeep`.
- **Bloco E — testes unitários restantes** (`[P]`): `load-config.spec.ts`,
  `error-handler.spec.ts`, `get-health.service.spec.ts` (unit, com fake repo).
- **Bloco F — CI e docs**: `.github/workflows/ci.yml` (install → lint → test:unit →
  test:integration → build; passo `test:coverage` que **agrega as duas suítes** e falha se a
  cobertura de `src/services/**` < 70%), `README.md` (passos do `quickstart.md`).
- Cada pasta de domínio termina com `index.ts` de re-export (dobrado na tarefa que cria os
  arquivos da pasta).

**Estratégia de ordenação**:
- Bootstrap (A) antes de qualquer código.
- TDD dentro do Bloco C: teste antes da implementação que o satisfaz.
- Dependência: `errors`/`config`/`db` antes de `container`; `container` e `repositories`
  antes de `services`; `services` antes de `controllers`; tudo antes de `app.ts`/`server.ts`.
- `[P]` para arquivos independentes (ex.: as classes de erro entre si, os testes unitários
  do Bloco E, `docker-compose.yml` vs `eslint.config.js`).
- CI (F) por último, quando os scripts npm que ele chama já existem.

**Estimativa**: ~48 tarefas (ver `tasks.md`).

## Rastreio de Complexidade

*Sem violações da Verificação da Constituição — nada a registrar.*

| Violação | Por que é necessária | Alternativa mais simples rejeitada e por quê |
|---|---|---|
| — | — | — |

## Progresso

- [x] Fase 0: pesquisa completa (`research.md`)
- [x] Fase 1: design completo (`data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md`)
- [x] Fase 1: telas mapeadas contra `design/` (N/A — sem `design/`, sem UI)
- [x] Verificação da Constituição: inicial aprovada
- [x] Verificação da Constituição: pós-design aprovada
- [x] Nenhum `[NEEDS CLARIFICATION]` restante
- [x] Fase 2: `/tasks` (`tasks.md` gerado — 48 tarefas, revisado pelo `/analyze`)
