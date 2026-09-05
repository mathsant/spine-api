# Plano de Implementação: Interações — comentar e curtir itens de feed

**Branch**: `007-interactions` | **Data**: 2026-09-04 | **Spec**: [specs/007-interactions/spec.md](./spec.md)
**Entrada**: especificação de feature em `specs/007-interactions/spec.md`

## Resumo

Permitir curtir (reação simples, idempotente) e comentar (texto, aninhamento de 1 nível, soft
delete) os itens de feed dos tipos `review_published`, `progress_update` e `finished_reading`
(006) — sempre respeitando a mesma regra de privacidade P6 (dono do item ou seguidor aprovado do
dono). Abordagem técnica: duas coleções novas (`comments`, `reactions`) referenciando `activities`
por `activityId`, com `readingSessionId`/`activityType` denormalizados para cascade de deleção sem
alterar o port `ActivityRepository` (006); um método novo (`findById`) nesse port para resolver o
alvo; um service compartilhado (`resolveVisibleActivity`) que centraliza a checagem de
existência/visibilidade/tipo suportado, reaproveitado pelos 4 services que agem sobre um
`activityId`; extensão do feed (`get-feed.service.ts`) para expor `reactionsCount`/`hasReacted` por
item; extensão dos cascades já existentes de `delete-reading-session`/`delete-review` para também
apagar comentários/curtidas órfãos. Nenhuma dependência nova.

## Contexto Técnico

<!-- Esta seção é lida pelo update-agent-context.sh para atualizar o CLAUDE.md do projeto. -->

**Linguagem/versão**: TypeScript ~5.9 (strict, `module: commonjs`, `target: es2022`) sobre Node.js v24
**Dependências principais**: Fastify ^5.12, Awilix ^13 + @fastify/awilix ^8.2, mongodb ^7.6 (driver nativo), zod ^4.5; **nenhuma dependência nova** — comentar/curtir são inserts/upserts/consultas indexadas simples, sem agregação nova além de um `$group` de contagem
**Armazenamento**: MongoDB — duas coleções novas, `comments` e `reactions`, criadas por migrations `migrate-mongo` reversíveis (índices detalhados em `data-model.md`); `mongodb-memory-server` ^11 nos testes de integração
**Testes**: Vitest ^5 + @vitest/coverage-v8 ^5; dois projects (`unit`, `integration`); regra de negócio (`services/comments/**`, `services/reactions/**`, `services/activities/**`, e as extensões de `delete-reading-session`, `delete-review`, `get-feed`) com `mongodb-memory-server`, sem mock de banco; gate de `src/services/**` ≥ 70%
**Ferramentas**: migrate-mongo ^14, ESLint flat + typescript-eslint + Prettier, tsx ^4 (dev), pino + pino-pretty (dev)
**Plataforma-alvo**: servidor Node.js (container Linux)
**Tipo de projeto**: single (backend monolito em camadas controller → service → repository)
**Metas de performance**: N/A específico; toda leitura/escrita nova é indexada por chave exata (`activityId`, `{activityId,userId}`, `{readingSessionId,activityType}`) — mesma ordem de grandeza das operações por id já existentes (003/004/005)
**Restrições**: `mongodb` só em `repositories/**`/`db/**`; services não importam Fastify; nenhum `export default`; `ActivityRepository` ganha só `findById` (nenhuma outra alteração de assinatura, D3 do research.md — cascade via denormalização, não via retorno de ids); comentário só tem soft delete, sem edição (decisão do `/specify`); curtida só existe em itens de feed, nunca em comentários (decisão do `/specify`)
**Escala/escopo**: 5 endpoints novos (`POST`/`DELETE /v1/activities/:activityId/reactions`, `POST`/`GET /v1/activities/:activityId/comments`, `DELETE /v1/comments/:commentId`); 3 services existentes alterados (`delete-reading-session`, `delete-review`, `get-feed`) + 6 services novos (`resolve-visible-activity`, `create-comment`, `list-comments`, `delete-comment`, `create-reaction`, `delete-reaction`); 2 repositories novos (`comments`, `reactions`) + 1 método novo em `ActivityRepository` (`findById`); 2 coleções novas + 2 migrations; 2 entidades persistidas novas (`Comment`, `Reaction`); 5 classes de erro novas (`ActivityNotFoundError`, `UnsupportedActivityInteractionError`, `CommentNotFoundError`, `CommentNestingTooDeepError`, `ReactionNotFoundError`); 3 pastas de domínio novas em `controllers`/`services`/`repositories`/`schemas` (`comments`, `reactions`, e `activities` só em `services`, sem controller/rota própria)

## Verificação da Constituição

*Gate obrigatório: rodado antes da Fase 0 e novamente após a Fase 1. Consulte `.specify/memory/constitution.md`.*

- [x] Idioma do código: inglês em todo artefato técnico (identificadores, arquivos, branches, commits, schema) — `comments`/`reactions`/`activities`, `CommentRecord`/`ReactionRecord`, todos os nomes de erro e rota em inglês; só `spec.md`/`plan.md`/`research.md`/`data-model.md`/`quickstart.md` em português (regra do fluxo SDD)
- [x] P1 Testes por tipo de código: `create-comment`/`list-comments`/`delete-comment`/`create-reaction`/`delete-reaction`/`resolve-visible-activity` e as 3 extensões são regra de negócio → integração com `mongodb-memory-server`; `to-dto.ts` de cada domínio é função pura → unitário; cobertura ≥ 70% (mesmo gate das features anteriores)
- [x] P2 Acesso a dados só via repositório: `CommentRepository`/`ReactionRepository` como interface + `Mongo*Repository`; nenhum service novo importa `mongodb`
- [x] P3 Validação de entrada com `zod` na borda: `createCommentSchema` (`text`, `parentCommentId`), `listCommentsSchema` (`cursor`, `limit`); rotas de reação não têm corpo, nada a validar além do `preHandler` de auth já existente
- [x] P4 Mudança de schema/índice apenas via migration versionada e reversível: `create-comments-collection`, `create-reactions-collection`
- [x] P5 Erros de domínio estendem o tipo de erro base: as 5 classes novas estendem `AppError` (ver `data-model.md`)

## Estrutura do Projeto

### Documentos desta feature (`specs/007-interactions/`)

```
specs/007-interactions/
├── spec.md
├── plan.md              # este arquivo
├── research.md          # saída da Fase 0
├── data-model.md         # saída da Fase 1
├── quickstart.md         # saída da Fase 1
├── contracts/            # saída da Fase 1
│   ├── error-codes.md
│   ├── internal-ports.md
│   └── interactions.openapi.yaml
└── tasks.md               # saída da Fase 2 (gerado pelo /tasks, não pelo /plan)
```

### Código-fonte (raiz do repositório)

Segue `.specify/memory/architecture.md` ("Onde cada tipo de código novo deve ir"), monolito em
camadas `controller → service → repository`. Arquivos novos/alterados desta feature:

```
src/
├── controllers/
│   ├── comments/
│   │   ├── comments.routes.ts               # NOVO
│   │   ├── create-comment.controller.ts     # NOVO
│   │   ├── list-comments.controller.ts      # NOVO
│   │   ├── delete-comment.controller.ts     # NOVO
│   │   └── index.ts                          # NOVO
│   └── reactions/
│       ├── reactions.routes.ts               # NOVO
│       ├── create-reaction.controller.ts     # NOVO
│       ├── delete-reaction.controller.ts     # NOVO
│       └── index.ts                          # NOVO
├── services/
│   ├── activities/
│   │   ├── resolve-visible-activity.ts       # NOVO — sem controller/rota própria
│   │   └── index.ts                          # NOVO
│   ├── comments/
│   │   ├── create-comment.service.ts         # NOVO
│   │   ├── list-comments.service.ts          # NOVO
│   │   ├── delete-comment.service.ts         # NOVO
│   │   ├── to-dto.ts                          # NOVO
│   │   ├── types.ts                           # NOVO
│   │   └── index.ts                          # NOVO
│   ├── reactions/
│   │   ├── create-reaction.service.ts        # NOVO
│   │   ├── delete-reaction.service.ts        # NOVO
│   │   └── index.ts                          # NOVO
│   ├── reading-sessions/
│   │   └── delete-reading-session.service.ts # ALTERADO (003) — cascade de comment/reaction
│   ├── reviews/
│   │   └── delete-review.service.ts          # ALTERADO (005) — cascade de comment/reaction
│   └── feed/
│       ├── get-feed.service.ts               # ALTERADO (006) — reactionsCount/hasReacted
│       └── types.ts                           # ALTERADO (006) — FeedItemDTO
├── repositories/
│   ├── comments/
│   │   ├── comment.repository.ts             # NOVO
│   │   ├── mongo-comment.repository.ts       # NOVO
│   │   └── index.ts                          # NOVO
│   ├── reactions/
│   │   ├── reaction.repository.ts            # NOVO
│   │   ├── mongo-reaction.repository.ts      # NOVO
│   │   └── index.ts                          # NOVO
│   └── activities/
│       ├── activity.repository.ts            # ALTERADO (006) — + findById
│       ├── mongo-activity.repository.ts      # ALTERADO (006)
│       └── index.ts                           # inalterado
├── schemas/
│   └── comments/
│       ├── create-comment.schema.ts          # NOVO
│       ├── list-comments.schema.ts           # NOVO
│       └── index.ts                          # NOVO
├── errors/
│   ├── activity-not-found-error.ts                 # NOVO
│   ├── unsupported-activity-interaction-error.ts   # NOVO
│   ├── comment-not-found-error.ts                  # NOVO
│   ├── comment-nesting-too-deep-error.ts           # NOVO
│   ├── reaction-not-found-error.ts                 # NOVO
│   └── index.ts                                     # ALTERADO — re-exports
└── container/
    ├── register-repositories.ts               # ALTERADO — + commentRepository, reactionRepository
    └── register-services.ts                   # ALTERADO — + services novos, deps novas nos existentes

migrations/
├── <timestamp>-create-comments-collection.js  # NOVO
└── <timestamp>-create-reactions-collection.js # NOVO

tests/
├── integration/services/
│   ├── activities/resolve-visible-activity.spec.ts    # NOVO
│   ├── comments/create-comment.service.spec.ts        # NOVO
│   ├── comments/list-comments.service.spec.ts         # NOVO
│   ├── comments/delete-comment.service.spec.ts        # NOVO
│   ├── reactions/create-reaction.service.spec.ts      # NOVO
│   ├── reactions/delete-reaction.service.spec.ts      # NOVO
│   ├── reading-sessions/delete-reading-session.service.spec.ts  # ALTERADO — cenário de cascade
│   ├── reviews/delete-review.service.spec.ts          # ALTERADO — cenário de cascade
│   └── feed/get-feed.service.spec.ts                  # ALTERADO — reactionsCount/hasReacted
└── unit/services/
    └── comments/to-dto.spec.ts                        # NOVO
```

## Fase 0: Pesquisa

Ver `research.md` — 8 decisões registradas (D1 a D8), nenhuma bloqueada por incógnita de stack
(a stack já está travada em `architecture.md`, reaproveitada sem alteração).

**Saída**: `research.md` com todas as incógnitas resolvidas.

## Fase 1: Design & Contratos

Concluída:

1. `data-model.md` — entidades `Comment`/`Reaction`, extensões de `ActivityRepository`/
   `delete-reading-session`/`delete-review`/`get-feed`, DTOs e tabela de erros novos.
2. `contracts/error-codes.md` + `contracts/internal-ports.md` + `contracts/interactions.openapi.yaml`
   — 5 endpoints, todos os ports/services/erros novos com assinatura completa.
3. Cenários de teste de integração mapeados 1:1 com os 11 cenários de aceitação da spec (ver seção
   `tests/` da estrutura acima).
4. `quickstart.md` — 10 passos cobrindo curtir/descurtir idempotente, comentar/responder/rejeitar
   aninhamento profundo, soft delete, privacidade P6, `started_reading` fora de escopo, e cascade.
5. Sem `design/` no repositório (API pura, sem UI) — passo de mapeamento de telas não se aplica.
6. `update-agent-context.sh` executado (ver abaixo).

**Saída**: `data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md` atualizado.

## Fase 2: Abordagem de Planejamento de Tarefas

*Esta seção descreve o que o comando `/tasks` fará — NÃO execute isso agora, e NÃO gere `tasks.md` aqui.*

**Estratégia de geração de tarefas**:
- Carregar `.specify/templates/tasks-template.md` como base.
- Uma tarefa por migration (2), por entidade/repository novo (`Comment`/`Reaction`, interface +
  implementação Mongo + índice), por service novo (6) e por extensão de service existente (3), por
  endpoint/contrato (5, controller + schema quando aplicável + rota), por erro novo (5) e por
  cenário de integração da spec (11 cenários de aceitação + 4 casos de borda).
- `resolve-visible-activity` é pré-requisito de `create-comment`/`list-comments`/`create-reaction`/
  `delete-reaction` — sua tarefa (e o `findById` do `ActivityRepository`) vem antes dessas quatro.

**Estratégia de ordenação**:
- Ordem TDD: teste de integração antes do service que ele cobre; teste unitário antes do `to-dto`.
- Ordem de dependência: migrations → repositories (`Comment`/`Reaction` + `ActivityRepository.findById`)
  → `resolve-visible-activity` → services de `comments`/`reactions` → extensões de
  `delete-reading-session`/`delete-review`/`get-feed` → controllers/rotas/schemas → registro no
  container (Awilix).
- Marcar `[P]` para tarefas em arquivos independentes que podem rodar em paralelo (ex.: os dois
  repositories novos; os testes de `create-comment` e `create-reaction` depois que
  `resolve-visible-activity` existir).

## Rastreio de Complexidade

*Nenhuma violação da Verificação da Constituição — seção não se aplica.*

## Progresso

- [x] Fase 0: pesquisa completa (`research.md`)
- [x] Fase 1: design completo (`data-model.md`, `contracts/`, `quickstart.md`, `CLAUDE.md`)
- [x] Fase 1: telas mapeadas contra `design/` (N/A — sem `design/` no repositório)
- [x] Verificação da Constituição: inicial aprovada
- [x] Verificação da Constituição: pós-design aprovada
- [x] Nenhum `[NEEDS CLARIFICATION]` restante
