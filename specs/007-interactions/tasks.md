# Tarefas: Interações — comentar e curtir itens de feed

**Entrada**: `plan.md`, `data-model.md`, `contracts/`, `quickstart.md` de `specs/007-interactions/`
**Convenção**: `[P]` = pode rodar em paralelo (arquivos diferentes, sem dependência entre si). Sem `[P]` = sequencial (mesma área de arquivo ou depende de outra tarefa).

Fases desenhadas como marcos entregáveis, não o esqueleto genérico do template: fundação de dados
→ resolução/visibilidade compartilhada → curtidas → comentários → cascade de deleção → feed
enriquecido → integração final. TDD dentro de cada fase (teste de integração/contrato antes da
implementação que ele cobre).

---

## Fase 1: Fundação — erros, migrations, repositories, extensão do `ActivityRepository`

- [x] T001 [P] Erro `ActivityNotFoundError` (404, `ACTIVITY_NOT_FOUND`) em `src/errors/activity-not-found-error.ts`
- [x] T002 [P] Erro `UnsupportedActivityInteractionError` (422, `UNSUPPORTED_ACTIVITY_INTERACTION`) em `src/errors/unsupported-activity-interaction-error.ts`
- [x] T003 [P] Erro `CommentNotFoundError` (404, `COMMENT_NOT_FOUND`) em `src/errors/comment-not-found-error.ts`
- [x] T004 [P] Erro `CommentNestingTooDeepError` (422, `COMMENT_NESTING_TOO_DEEP`) em `src/errors/comment-nesting-too-deep-error.ts`
- [x] T005 [P] Erro `ReactionNotFoundError` (404, `REACTION_NOT_FOUND`) em `src/errors/reaction-not-found-error.ts`
- [x] T006 Reexportar os 5 erros novos (T001-T005) em `src/errors/index.ts`
- [x] T007 [P] Teste de integração: `findById` de `ActivityRepository` (existente/inexistente) em `tests/integration/repositories/activities/mongo-activity.repository.spec.ts` (deve falhar até T008)
- [x] T008 Implementar `findById(activityId): Promise<ActivityRecord | null>` em `src/repositories/activities/activity.repository.ts` (assinatura) e `src/repositories/activities/mongo-activity.repository.ts` (impl) — D1 do `research.md`
- [x] T009 [P] Migration `create-comments-collection` (via `pnpm migrate:create create-comments-collection`) em `migrations/<timestamp>-create-comments-collection.js` — coleção `comments`, índice `{ activityId: 1, createdAt: 1, _id: 1 }` e índice `{ readingSessionId: 1, activityType: 1 }` (ver `data-model.md`)
- [x] T010 [P] Migration `create-reactions-collection` (via `pnpm migrate:create create-reactions-collection`) em `migrations/<timestamp>-create-reactions-collection.js` — coleção `reactions`, índice **único** `{ activityId: 1, userId: 1 }` e índice `{ readingSessionId: 1, activityType: 1 }`
- [x] T011 [P] Teste de integração do `CommentRepository` (create, findById, listByActivity paginado ascendente, softDelete, deleteByReadingSessionId, deleteByReadingSessionIdAndType) em `tests/integration/repositories/comments/mongo-comment.repository.spec.ts` (deve falhar até T013-T014)
- [x] T012 [P] Teste de integração do `ReactionRepository` (add idempotente, remove, countByActivityIds, listReactedActivityIds, deleteByReadingSessionId, deleteByReadingSessionIdAndType) em `tests/integration/repositories/reactions/mongo-reaction.repository.spec.ts` (deve falhar até T015-T016)
- [x] T013 Interface `CommentRepository`/`CommentRecord`/`CreateCommentInput` em `src/repositories/comments/comment.repository.ts`
- [x] T014 Implementação `MongoCommentRepository` em `src/repositories/comments/mongo-comment.repository.ts` (depende de T013, faz T011 passar)
- [x] T015 [P] Interface `ReactionRepository`/`ReactionRecord` em `src/repositories/reactions/reaction.repository.ts`
- [x] T016 Implementação `MongoReactionRepository` em `src/repositories/reactions/mongo-reaction.repository.ts` (depende de T015, faz T012 passar)
- [x] T017 [P] `src/repositories/comments/index.ts` — reexports nomeados (depende de T013/T014)
- [x] T018 [P] `src/repositories/reactions/index.ts` — reexports nomeados (depende de T015/T016)
- [x] T019 Registrar `commentRepository`/`reactionRepository` (Awilix, `asFunction(...).singleton()`) em `src/container/register-repositories.ts`
- [x] T020 Adicionar `CommentRepository`/`ReactionRepository` ao tipo `AppCradle` em `src/container/cradle.ts`

## Fase 2: Resolução de visibilidade compartilhada — `resolveVisibleActivity`

- [x] T021 Teste de integração de `resolveVisibleActivity` (dono vê, seguidor aprovado vê, não-seguidor recebe `ActivityNotFoundError`, `activityId` inexistente recebe `ActivityNotFoundError`, tipo `started_reading` recebe `UnsupportedActivityInteractionError`) em `tests/integration/services/activities/resolve-visible-activity.spec.ts` (deve falhar até T022)
- [x] T022 Implementar `resolveVisibleActivity` em `src/services/activities/resolve-visible-activity.ts` (D1/D2 do `research.md`)
- [x] T023 `src/services/activities/index.ts` — reexports nomeados (depende de T022)
- [x] T024 Adicionar `ResolveVisibleActivity` ao `AppCradle` em `src/container/cradle.ts` e registrar `resolveVisibleActivityService` em `src/container/register-services.ts`

## Fase 3: Curtidas (reactions) — RF-001 a RF-004, RF-014

- [x] T025 [P] Teste de integração de `create-reaction` (curta pela 1ª vez, repetir é idempotente — cenário 1/2; próprio dono curte — cenário 8; `started_reading` rejeitado — cenário 11; item não visível rejeitado — cenário 9) em `tests/integration/services/reactions/create-reaction.service.spec.ts` (deve falhar até T027)
- [x] T026 [P] Teste de integração de `delete-reaction` (remove existente — cenário 3; remove inexistente lança `ReactionNotFoundError`) em `tests/integration/services/reactions/delete-reaction.service.spec.ts` (deve falhar até T028)
- [x] T027 Implementar `create-reaction.service.ts` em `src/services/reactions/create-reaction.service.ts` (usa `resolveVisibleActivity` + `reactionRepository.add`)
- [x] T028 Implementar `delete-reaction.service.ts` em `src/services/reactions/delete-reaction.service.ts` (usa `resolveVisibleActivity` + `reactionRepository.remove`, lança `ReactionNotFoundError` se nada removido)
- [x] T029 `src/services/reactions/index.ts` — reexports nomeados (depende de T027/T028)
- [x] T030 Adicionar `CreateReaction`/`DeleteReaction` ao `AppCradle` em `src/container/cradle.ts` e registrar `createReactionService`/`deleteReactionService` em `src/container/register-services.ts`
- [x] T031 Teste de contrato HTTP (`POST`/`DELETE /v1/activities/:activityId/reactions` — 204 idempotente, 401 sem auth, 404 `ActivityNotFoundError`, 422 `UnsupportedActivityInteractionError`) em `tests/integration/http/reactions.routes.spec.ts` (deve falhar até T032-T034)
- [x] T032 [P] Controller `createReactionController` em `src/controllers/reactions/create-reaction.controller.ts`
- [x] T033 [P] Controller `deleteReactionController` em `src/controllers/reactions/delete-reaction.controller.ts`
- [x] T034 `reactionsRoutes` (plugin Fastify, prefix `/v1`) em `src/controllers/reactions/reactions.routes.ts` e reexports em `src/controllers/reactions/index.ts` (depende de T032/T033)
- [x] T035 Registrar `reactionsRoutes` em `src/app.ts` (faz T031 passar)

## Fase 4: Comentários (comments) — RF-005 a RF-010, RF-014

- [x] T036 [P] Teste unitário de `createCommentSchema` (texto vazio rejeitado, `parentCommentId` opcional) em `tests/unit/schemas/comments/create-comment.schema.spec.ts` (deve falhar até T039)
- [x] T037 [P] Teste unitário de `listCommentsSchema` (`cursor`/`limit` — default e limites) em `tests/unit/schemas/comments/list-comments.schema.spec.ts` (deve falhar até T040)
- [x] T038 [P] Teste unitário de `toCommentDTO` (texto normal vs. `"[removido]"` quando `deletedAt !== null`) em `tests/unit/services/comments/to-dto.spec.ts` (deve falhar até T045)
- [x] T039 [P] Schema `createCommentSchema` em `src/schemas/comments/create-comment.schema.ts`
- [x] T040 [P] Schema `listCommentsSchema` em `src/schemas/comments/list-comments.schema.ts`
- [x] T041 `src/schemas/comments/index.ts` — reexports nomeados (depende de T039/T040)
- [x] T042 [P] Teste de integração de `create-comment` (top-level — cenário 4; resposta a top-level — cenário 5; resposta a resposta lança `CommentNestingTooDeepError` — cenário 6; próprio dono comenta — cenário 8; texto vazio rejeitado; `started_reading`/item não visível rejeitados) em `tests/integration/services/comments/create-comment.service.spec.ts` (deve falhar até T046)
- [x] T043 [P] Teste de integração de `list-comments` (ordem cronológica ascendente, paginação por cursor, resposta apagada ainda aceita nova resposta — caso de borda) em `tests/integration/services/comments/list-comments.service.spec.ts` (deve falhar até T047)
- [x] T044 [P] Teste de integração de `delete-comment` (autor apaga — cenário 7, texto vira placeholder mas thread/respostas preservadas; não-autor recebe `CommentNotFoundError`) em `tests/integration/services/comments/delete-comment.service.spec.ts` (deve falhar até T048)
- [x] T045 `src/services/comments/types.ts` (`CommentDTO`, `CommentCursorPageDTO`) e `src/services/comments/to-dto.ts` (`toCommentDTO`) — faz T038 passar
- [x] T046 Implementar `create-comment.service.ts` em `src/services/comments/create-comment.service.ts` (usa `resolveVisibleActivity`; valida `parentCommentId` via `commentRepository.findById`)
- [x] T047 Implementar `list-comments.service.ts` em `src/services/comments/list-comments.service.ts` (usa `resolveVisibleActivity` só para validar acesso + `commentRepository.listByActivity`)
- [x] T048 Implementar `delete-comment.service.ts` em `src/services/comments/delete-comment.service.ts` (checa posse, sem `resolveVisibleActivity` — D6 do `research.md`)
- [x] T049 `src/services/comments/index.ts` — reexports nomeados (depende de T046-T048)
- [x] T050 Adicionar `CreateComment`/`ListComments`/`DeleteComment` ao `AppCradle` em `src/container/cradle.ts` e registrar os 3 services em `src/container/register-services.ts`
- [x] T051 Teste de contrato HTTP (`POST`/`GET /v1/activities/:activityId/comments`, `DELETE /v1/comments/:commentId` — 201/200/204, 400 texto vazio, 401, 404, 422 aninhamento profundo) em `tests/integration/http/comments.routes.spec.ts` (deve falhar até T052-T054)
- [x] T052 [P] Controllers `createCommentController`/`listCommentsController` em `src/controllers/comments/create-comment.controller.ts` e `src/controllers/comments/list-comments.controller.ts`
- [x] T053 [P] Controller `deleteCommentController` em `src/controllers/comments/delete-comment.controller.ts`
- [x] T054 `commentsRoutes` (plugin Fastify, prefix `/v1`) em `src/controllers/comments/comments.routes.ts` e reexports em `src/controllers/comments/index.ts` (depende de T052/T053)
- [x] T055 Registrar `commentsRoutes` em `src/app.ts` (faz T051 passar)

## Fase 5: Cascade de deleção sem órfão — RF-013

- [x] T056 [P] Estender teste de `delete-reading-session.service.spec.ts` (`tests/integration/services/reading-sessions/delete-reading-session.service.spec.ts`) com o cenário 10: comentários/curtidas de qualquer `activityType` da session somem junto (deve falhar até T058)
- [x] T057 [P] Estender teste de `delete-review.service.spec.ts` (`tests/integration/services/reviews/delete-review.service.spec.ts`) com o cenário equivalente para `review_published`: comentários/curtidas somem junto ao apagar só a review (deve falhar até T059)
- [x] T058 Estender `delete-reading-session.service.ts` (`src/services/reading-sessions/delete-reading-session.service.ts`) com deps `commentRepository`/`reactionRepository` e chamadas a `deleteByReadingSessionId` após o cascade de `activityRepository` já existente
- [x] T059 Estender `delete-review.service.ts` (`src/services/reviews/delete-review.service.ts`) com deps `commentRepository`/`reactionRepository` e chamadas a `deleteByReadingSessionIdAndType(sessionId, 'review_published')` após o cascade já existente
- [x] T060 Passar `commentRepository`/`reactionRepository` nas factories de `deleteReadingSessionService` e `deleteReviewService` em `src/container/register-services.ts`

## Fase 6: Feed enriquecido — `reactionsCount`/`hasReacted` (RF-004)

- [x] T061 Estender `get-feed.service.spec.ts` (`tests/integration/services/feed/get-feed.service.spec.ts`) com casos de `reactionsCount`/`hasReacted` por item (0/false sem curtida, incrementa com curtida do próprio viewer e de terceiros) — deve falhar até T063
- [x] T062 Adicionar `reactionsCount: number` e `hasReacted: boolean` a `FeedItemDTO` em `src/services/feed/types.ts` e preencher em `src/services/feed/to-dto.ts`
- [x] T063 Estender `get-feed.service.ts` (`src/services/feed/get-feed.service.ts`) com dep `reactionRepository` e os lookups em lote `countByActivityIds`/`listReactedActivityIds` (D7 do `research.md`)
- [x] T064 Passar `reactionRepository` na factory de `getFeedService` em `src/container/register-services.ts`
- [x] T065 [P] Estender `feed.routes.spec.ts` (`tests/integration/http/feed.routes.spec.ts`) para afirmar a presença de `reactionsCount`/`hasReacted` na resposta HTTP

## Fase 7: Integração final e polimento

- [x] T066 Rodar `pnpm migrate:up` localmente e confirmar as duas coleções/índices novos (`comments`, `reactions`) antes de rodar a suíte
- [x] T067 Rodar `pnpm test` (unit + integration) e `pnpm test:coverage`, confirmar gate de 70% em `src/services/comments/**`, `src/services/reactions/**` e `src/services/activities/**`, e nenhuma regressão nos specs pré-existentes de `reading-sessions`/`reviews`/`feed`
- [x] T068 Executar manualmente os 10 passos de `quickstart.md` contra o servidor local (`pnpm dev`) e confirmar cada resultado esperado
- [x] T069 Revisão final: remover duplicação entre `create-comment`/`create-reaction`/`delete-reaction`/`list-comments` (uso consistente de `resolveVisibleActivity`), conferir que nenhum novo arquivo importa `mongodb` fora de `repositories/**`, e que nenhum `export default` foi introduzido

---

## Dependências

- **Fase 1** é pré-requisito de todas as outras (repositories e erros usados em todo o resto).
  Dentro dela: T001-T006 (erros) e T007-T008 (`findById`) e T009-T010 (migrations) são
  independentes entre si; T011-T020 (repositories novos) dependem de T007-T008 só
  indiretamente (mesmo domínio de dados, sem dependência de código real) e podem começar em
  paralelo com eles.
- **Fase 2** (T021-T024) depende de T008 (`ActivityRepository.findById`) e do `FollowRepository`
  já existente (004) — não depende de T011-T020.
- **Fase 3** (T025-T035) depende da Fase 2 (`resolveVisibleActivity`) e de T015-T018
  (`ReactionRepository`).
- **Fase 4** (T036-T055) depende da Fase 2 e de T013-T014/T017 (`CommentRepository`); é
  independente da Fase 3 (domínios/arquivos diferentes) — podem ser feitas em paralelo por duas
  pessoas/agentes.
- **Fase 5** (T056-T060) depende só da Fase 1 (`CommentRepository`/`ReactionRepository` com os
  métodos de cascade) — não depende das Fases 3/4 estarem prontas, só dos repositories existirem.
- **Fase 6** (T061-T065) depende só de T015-T018 (`ReactionRepository`) — pode rodar em paralelo
  com as Fases 3-5.
- **Fase 7** depende de todas as anteriores.
- Dentro de cada fase: teste (integração/contrato/unitário) sempre antes da implementação que o
  faz passar (TDD) — ver "deve falhar até T0XX" em cada tarefa de teste.

## Exemplo de execução em paralelo

```
# Fase 1 — erros, migrations e interfaces de repository não têm dependência entre si:
Tarefa: "T001 Erro ActivityNotFoundError em src/errors/activity-not-found-error.ts"
Tarefa: "T002 Erro UnsupportedActivityInteractionError em src/errors/unsupported-activity-interaction-error.ts"
Tarefa: "T009 Migration create-comments-collection em migrations/<timestamp>-create-comments-collection.js"
Tarefa: "T010 Migration create-reactions-collection em migrations/<timestamp>-create-reactions-collection.js"
Tarefa: "T011 Teste de integração do CommentRepository em tests/integration/repositories/comments/mongo-comment.repository.spec.ts"
Tarefa: "T012 Teste de integração do ReactionRepository em tests/integration/repositories/reactions/mongo-reaction.repository.spec.ts"

# Fases 3 e 4 são domínios independentes depois que a Fase 2 termina:
Tarefa: "T025 Teste de integração de create-reaction em tests/integration/services/reactions/create-reaction.service.spec.ts"
Tarefa: "T042 Teste de integração de create-comment em tests/integration/services/comments/create-comment.service.spec.ts"
```

## Notas

- `[P]` = arquivos diferentes, sem dependências entre as tarefas marcadas.
- Caminhos de arquivo/pasta e identificadores nas tarefas sempre em **inglês** (regra fixa do
  kit); a descrição da tarefa fica em português.
- Cada teste de integração/contrato deve existir e **falhar** antes da tarefa de implementação
  correspondente ser feita.
- Commitar após cada tarefa concluída.
- Nenhuma tarefa aqui ficou bloqueada por informação faltando em `plan.md`/`data-model.md` — os 5
  endpoints, as 2 entidades, os 5 erros e as 3 extensões de service existente já tinham assinatura
  completa nos artefatos da Fase 1 do `/plan`.
