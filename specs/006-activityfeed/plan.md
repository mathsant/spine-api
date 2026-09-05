# Plano de Implementação: Feed de atividade

**Branch**: `006-activityfeed` | **Data**: 2026-09-04 | **Spec**: [spec.md](./spec.md)
**Entrada**: especificação de feature em `specs/006-activityfeed/spec.md`

## Resumo

Endpoint único `GET /v1/feed`, paginado por cursor, que mostra a atividade (começou a ler,
terminou de ler, publicou review, progress update) de quem o usuário autenticado segue com follow
aprovado — misturada com a própria atividade dele (RF-008). É um log append-only (`activities`,
fan-out on read, conforme já travado em `product.md`) alimentado como efeito colateral de 5
services já existentes (003/005), sem endpoint de escrita próprio. Deleções em cascata (reading
session, review) mantêm o log sempre consistente, então a leitura do feed não precisa checar
existência a cada página (D4 do `research.md`).

## Contexto Técnico

**Linguagem/versão**: TypeScript ~5.9 (strict, `module: commonjs`, `target: es2022`) sobre Node.js v24
**Dependências principais**: Fastify ^5.12, Awilix ^13 + @fastify/awilix ^8.2, mongodb ^7.6 (driver nativo), zod ^4.5; **nenhuma dependência nova** — o feed é uma consulta indexada (`$in` + sort), não uma agregação
**Armazenamento**: MongoDB — coleção nova `activities` criada por 1 migration `migrate-mongo` reversível (índice composto `{ actorId: 1, createdAt: -1, _id: -1 }` para o filtro `$in`+cursor do feed, índice `{ readingSessionId: 1 }` para os cascades de deleção); `mongodb-memory-server` ^11 nos testes de integração
**Testes**: Vitest ^5 + @vitest/coverage-v8 ^5; dois projects (`unit`, `integration`); regra de negócio (`services/feed/**` e as 6 extensões — start-reading, mark-finished, update-progress, finish-reading-session, delete-reading-session, create-review, delete-review) com `mongodb-memory-server`, sem mock de banco; gate de `src/services/**` ≥ 70%
**Ferramentas**: migrate-mongo ^14, ESLint flat + typescript-eslint + Prettier, tsx ^4 (dev), pino + pino-pretty (dev)
**Plataforma-alvo**: servidor Node.js (container Linux)
**Tipo de projeto**: single (backend monolito em camadas controller → service → repository)
**Metas de performance**: N/A específico; a consulta do feed é um `$in` de atores + sort por índice composto (D7 do research.md) — mesma ordem de grandeza das listas por cursor já existentes (003/004); nenhuma agregação nova
**Restrições**: `mongodb` só em `repositories/**`/`db/**`; services não importam Fastify; nenhum `export default`; `activities` não tem índice único (múltiplos eventos por session são esperados); nenhuma escrita em `activities` acontece fora dos 5 pontos de gravação e 2 pontos de cascade já mapeados em `data-model.md`/`internal-ports.md`; feed nunca resolve `404`/`403` — lista vazia é resposta válida (RF-013)
**Escala/escopo**: 1 endpoint novo (`GET /v1/feed`); 6 services existentes alterados (start-reading, mark-finished, update-progress, finish-reading-session, delete-reading-session, create-review, delete-review) + 1 service novo (`get-feed`); 1 repository novo (`activities`) + 1 método novo em `FollowRepository` (`listFolloweeIds`); 1 coleção nova + 1 migration; 1 entidade persistida nova (`Activity`); 0 classes de erro novas (reaproveita `ValidationError`/`UnauthenticatedError`); 1 pasta de domínio nova em `controllers`/`services`/`repositories`/`schemas` (`feed`)

## Verificação da Constituição

*Gate obrigatório: rodado antes da Fase 0 e novamente após a Fase 1. Consulte `.specify/memory/constitution.md`.*

- [x] Idioma do código: inglês em todo artefato técnico (identificadores, arquivos, branches, commits, schema) — `activities`, `ActivityRepository`, `getFeedService`, tipos `started_reading`/etc. todos em inglês
- [x] P1 Testes por tipo de código: `get-feed.service.ts` e as 6 extensões são regra de negócio → integração com `mongodb-memory-server`; `to-dto`/schema zod → unitário; cobertura ≥ 70% com caminho feliz + ≥1 caminho de erro (cursor inválido)
- [x] P2 Acesso a dados só via repositório: `ActivityRepository` (interface + `MongoActivityRepository`); `get-feed.service.ts` só depende de interfaces do cradle Awilix, nunca do driver
- [x] P3 Validação de entrada com `zod` na borda: `getFeedSchema` (`cursor?`, `limit?`) valida a querystring antes do controller chamar o service
- [x] P4 Mudança de schema/índice apenas via migration: `create-activities-collection` cria a coleção + os 2 índices; nenhum `createIndex` fora dela
- [x] P5 Erros de domínio estendem o tipo de erro base: nenhum erro novo nesta feature; `cursor` inválido continua reaproveitando `ValidationError` (`decodeCursor`, `src/lib/pagination.ts`) já usada por 003/004

Nenhuma violação — sem entradas em "Rastreio de Complexidade".

## Estrutura do Projeto

### Documentos desta feature (`specs/006-activityfeed/`)

```
specs/006-activityfeed/
├── spec.md
├── plan.md              # este arquivo
├── research.md          # saída da Fase 0
├── data-model.md         # saída da Fase 1
├── quickstart.md         # saída da Fase 1
├── contracts/            # saída da Fase 1
│   ├── internal-ports.md
│   ├── error-codes.md
│   └── feed.openapi.yaml
└── tasks.md               # saída da Fase 2 (gerado pelo /tasks, não pelo /plan)
```

### Código-fonte (raiz do repositório)

Segue exatamente a tabela "Onde cada tipo de código novo deve ir" de `architecture.md` — monolito
em camadas, sem estrutura nova.

```
src/
├── controllers/feed/
│   ├── feed.routes.ts
│   ├── get-feed.controller.ts
│   └── index.ts
├── services/feed/
│   ├── get-feed.service.ts
│   ├── to-dto.ts
│   ├── types.ts
│   └── index.ts
├── repositories/activities/
│   ├── activity.repository.ts        # interface
│   ├── mongo-activity.repository.ts  # implementação
│   └── index.ts
├── schemas/feed/
│   ├── get-feed.schema.ts
│   └── index.ts
├── repositories/follows/
│   ├── follow.repository.ts          # + listFolloweeIds (alterado)
│   └── mongo-follow.repository.ts    # + implementação (alterado)
├── services/reading-sessions/
│   ├── start-reading.service.ts          # alterado — grava started_reading
│   ├── mark-finished.service.ts          # alterado — grava finished_reading + ganha Clock
│   ├── update-progress.service.ts        # alterado — grava progress_update + ganha Clock
│   ├── finish-reading-session.service.ts # alterado — grava finished_reading (guardado por status)
│   └── delete-reading-session.service.ts # alterado — cascade deleteBySessionId
└── services/reviews/
    ├── create-review.service.ts  # alterado — grava review_published + ganha Clock
    └── delete-review.service.ts  # alterado — cascade deleteBySessionIdAndType

migrations/
└── <timestamp>-create-activities-collection.js

tests/
├── unit/schemas/feed/get-feed.schema.spec.ts
└── integration/
    ├── services/feed/get-feed.service.spec.ts
    ├── services/reading-sessions/*.spec.ts   # specs existentes ganham asserts de Activity
    └── services/reviews/*.spec.ts            # idem
```

## Fase 0: Pesquisa

Ver `research.md` — 7 decisões (D1–D7), nenhum `[NEEDS CLARIFICATION]` restante no Contexto
Técnico (a stack já vinha travada de `architecture.md`, reaproveitada sem alteração).

**Saída**: `research.md` completo.

## Fase 1: Design & Contratos

1. Entidades → `data-model.md`: `Activity` (nova) + extensões de `FollowRepository` e dos 6
   services existentes.
2. Contratos → `contracts/`: `internal-ports.md` (interfaces TS), `error-codes.md` (nenhum erro
   novo, só reaproveitados), `feed.openapi.yaml` (o único endpoint HTTP novo).
3. Cenários de teste de integração extraídos dos 13 cenários de aceitação do `spec.md` — listados
   em `quickstart.md` como chamadas HTTP manuais equivalentes.
4. `quickstart.md` gerado com os passos manuais (2 contas, follow aprovado, geração de atividade,
   consulta de feed, edição/exclusão refletindo, privacidade, autofeed, paginação).
5. `design/` não existe neste repositório (API pura, sem UI) — passo de mapeamento de telas
   pulado, conforme instrução do template.
6. `update-agent-context.sh` executado ao final desta fase (ver Progresso).

**Saída**: `data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md` atualizado.

### Verificação da Constituição (pós-design)

Repetida após a Fase 1 — nenhuma decisão de design (D1–D7) introduziu violação nova. Os 5 gates
seguem `[x]` como na verificação inicial; nenhuma entrada em "Rastreio de Complexidade".

## Fase 2: Abordagem de Planejamento de Tarefas

*Esta seção descreve o que o comando `/tasks` fará — NÃO execute isso agora, e NÃO gere `tasks.md` aqui.*

**Estratégia de geração de tarefas**:
- Carregar `.specify/templates/tasks-template.md` como base.
- 1 tarefa de migration (`create-activities-collection`, com `up`/`down`).
- 1 tarefa por contrato: `ActivityRepository` (interface + `MongoActivityRepository`),
  `FollowRepository.listFolloweeIds` (+ implementação Mongo), `get-feed.service.ts`, schema
  `getFeedSchema`, controller + rota `GET /v1/feed`, registro no container (repository + service).
- 1 tarefa por extensão de service existente (6): `start-reading`, `mark-finished`,
  `update-progress`, `finish-reading-session`, `delete-reading-session`, `create-review`,
  `delete-review` — cada uma leva seu teste de integração atualizado/novo junto (TDD: teste
  cobrindo a gravação/cascade de `Activity` antes do código).
- 1 tarefa de teste de integração por cenário de aceitação relevante do `spec.md` (13 cenários,
  agrupáveis por arquivo de spec: `get-feed.service.spec.ts` cobre a maioria; os specs já
  existentes de reading-sessions/reviews ganham novos `it()` para a gravação/cascade de `Activity`
  em vez de arquivos novos).
- 1 tarefa de teste unitário para `getFeedSchema` e para `src/services/feed/to-dto.ts`.
- 1 tarefa de quickstart/regressão final (`pnpm test`, `pnpm test:coverage`).

**Estratégia de ordenação**:
- Ordem TDD: teste antes do código que o satisfaz, em cada tarefa.
- Ordem de dependência: migration → `ActivityRepository`/`FollowRepository.listFolloweeIds` →
  extensões dos 6 services (gravação/cascade) → `get-feed.service` (consome tudo acima) →
  schema/controller/rota → registro no container → testes de cenário ponta a ponta →
  quickstart/regressão.
- `[P]` (paralelizável) nas 6 extensões de service entre si (arquivos independentes) e na dupla
  `ActivityRepository`/`FollowRepository.listFolloweeIds` (repositórios independentes).

## Rastreio de Complexidade

*Vazio — nenhuma violação da Verificação da Constituição.*

## Progresso

- [x] Fase 0: pesquisa completa (`research.md`)
- [x] Fase 1: design completo (`data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md`)
- [x] Fase 1: telas mapeadas contra `design/` (N/A — repositório sem `design/`, API pura)
- [x] Verificação da Constituição: inicial aprovada
- [x] Verificação da Constituição: pós-design aprovada
- [x] Nenhum `[NEEDS CLARIFICATION]` restante
