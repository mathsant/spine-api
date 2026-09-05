# Tarefas: Fluxo de notificações

**Entrada**: `plan.md`, `data-model.md`, `contracts/`, `quickstart.md` de `specs/008-notificationflow/`
**Convenção**: `[P]` = pode rodar em paralelo (arquivos diferentes, sem dependência entre si). Sem `[P]` = sequencial (mesma área de arquivo ou depende de outra tarefa).

Fases desenhadas como marcos entregáveis, não o esqueleto genérico do template: fundação de dados
(erro, migration, repository, extensão do `ReactionRepository`) → helper compartilhado
`createNotification` → integração com follow → integração com comentários → integração com
curtidas → cascade em lote (session/review) → API de leitura (listar/contar/marcar como lida) →
integração final. TDD dentro de cada fase (teste de integração/contrato/unitário antes da
implementação que ele cobre).

---

## Fase 1: Fundação — erro, migration, `NotificationRepository`, extensão do `ReactionRepository`

- [x] T001 [P] Erro `NotificationNotFoundError` (404, `NOTIFICATION_NOT_FOUND`) em `src/errors/notification-not-found-error.ts`
- [x] T002 Reexportar `NotificationNotFoundError` (T001) em `src/errors/index.ts`
- [x] T003 [P] Migration `create-notifications-collection` (via `pnpm migrate:create create-notifications-collection`) em `migrations/<timestamp>-create-notifications-collection.js` — coleção `notifications` e os 5 índices do `data-model.md`: `{ recipientId: 1, createdAt: -1, _id: -1 }`, `{ recipientId: 1, readAt: 1 }`, `{ recipientId: 1, actorId: 1, type: 1, activityId: 1 }`, `{ commentId: 1 }` (parcial), `{ readingSessionId: 1, activityType: 1 }` (parcial)
- [x] T004 [P] Estender o teste de integração existente do `ReactionRepository` (`tests/integration/repositories/reactions/mongo-reaction.repository.spec.ts`) com o caso: `add` devolve `true` na primeira chamada e `false` numa chamada repetida para o mesmo par `activityId`/`userId` (deve falhar até T006)
- [x] T005 [P] Teste de integração do `NotificationRepository` (create, findById, listByRecipient paginado descendente, markRead idempotente, markAllRead, countUnread, deleteFollowRequestNotification, deleteReactionNotification, deleteByCommentId, deleteByReadingSessionId, deleteByReadingSessionIdAndType) em `tests/integration/repositories/notifications/mongo-notification.repository.spec.ts` (deve falhar até T008)
- [x] T006 Alterar `add(...)` para `Promise<boolean>` em `src/repositories/reactions/reaction.repository.ts` (interface) e usar `result.upsertedCount > 0` em `src/repositories/reactions/mongo-reaction.repository.ts` (faz T004 passar)
- [x] T007 [P] Interface `NotificationRepository`/`NotificationRecord`/`NotificationType`/`CreateNotificationRecordInput` em `src/repositories/notifications/notification.repository.ts`
- [x] T008 Implementação `MongoNotificationRepository` em `src/repositories/notifications/mongo-notification.repository.ts` (depende de T007, faz T005 passar)
- [x] T009 `src/repositories/notifications/index.ts` — reexports nomeados (depende de T007/T008)
- [x] T010 Registrar `notificationRepository` (Awilix, `asFunction(...).singleton()`) em `src/container/register-repositories.ts` e adicionar `NotificationRepository` ao `AppCradle` em `src/container/cradle.ts` (depende de T008/T009)

## Fase 2: Helper compartilhado — `createNotification`

- [x] T011 Teste de integração de `createNotification` (cria quando `recipientId !== actorId`; no-op quando `recipientId === actorId` — RF-009) em `tests/integration/services/notifications/create-notification.spec.ts` (deve falhar até T012)
- [x] T012 Implementar `createNotification` em `src/services/notifications/create-notification.ts` (D4 do `research.md`, depende de T007/T008)
- [x] T013 `src/services/notifications/index.ts` — reexports nomeados de `createNotification` (depende de T012)
- [x] T014 Adicionar `CreateNotification` ao `AppCradle` em `src/container/cradle.ts` e registrar `createNotificationService` em `src/container/register-services.ts` (depende de T010, T012)

## Fase 3: Integração com follow — RF-001 a RF-004

- [x] T015 [P] Estender `tests/integration/services/follows/send-follow-request.service.spec.ts` com o cenário 1: pedido novo gera notificação `follow_request`; reenvio de pedido já pendente (`created: false`) não cria uma nova (D1 do `research.md`) (deve falhar até T018)
- [x] T016 [P] Estender `tests/integration/services/follows/approve-follow-request.service.spec.ts` com o cenário 2: aprovar remove a notificação `follow_request` pendente do aprovador e cria `follow_approved` para quem pediu (deve falhar até T019)
- [x] T017 [P] Estender `tests/integration/services/follows/reject-follow-request.service.spec.ts` com o cenário 3: recusar remove a notificação `follow_request` pendente e não cria nenhuma notificação nova (deve falhar até T020)
- [x] T018 Estender `send-follow-request.service.ts` (`src/services/follows/send-follow-request.service.ts`) com dep `createNotification` — chama só quando `created === true`
- [x] T019 Estender `approve-follow-request.service.ts` (`src/services/follows/approve-follow-request.service.ts`) com deps `notificationRepository`/`createNotification` — `deleteFollowRequestNotification(targetId, requesterId)` seguido de `createNotification({ type: 'follow_approved', ... })`
- [x] T020 Estender `reject-follow-request.service.ts` (`src/services/follows/reject-follow-request.service.ts`) com dep `notificationRepository` — só `deleteFollowRequestNotification(targetId, requesterId)`
- [x] T021 Passar `createNotification`/`notificationRepository` nas factories de `sendFollowRequestService`, `approveFollowRequestService` e `rejectFollowRequestService` em `src/container/register-services.ts` (depende de T014/T010, T018-T020)

## Fase 4: Integração com comentários — RF-005 a RF-007, RF-009, RF-010

- [x] T022 [P] Estender `tests/integration/services/comments/create-comment.service.spec.ts` com os cenários 4/6/7/10: comentário top-level notifica o dono do item (`comment_on_content`); resposta notifica o autor do comentário-pai (`comment_reply`) e também o dono do item quando são pessoas diferentes; quando dono do item == autor do comentário-pai, só a notificação `comment_reply` é criada (dedup, D3 do `research.md`); autor comentando no próprio item não se auto-notifica (deve falhar até T024)
- [x] T023 [P] Estender `tests/integration/services/comments/delete-comment.service.spec.ts` com o cenário 5: apagar o comentário remove toda notificação (`comment_on_content`/`comment_reply`) que ele originou (deve falhar até T025)
- [x] T024 Estender `create-comment.service.ts` (`src/services/comments/create-comment.service.ts`) com dep `createNotification` — lógica de dedup do D3 do `research.md`
- [x] T025 Estender `delete-comment.service.ts` (`src/services/comments/delete-comment.service.ts`) com dep `notificationRepository` — `deleteByCommentId(commentId)` após o soft delete
- [x] T026 Passar `createNotification`/`notificationRepository` nas factories de `createCommentService`/`deleteCommentService` em `src/container/register-services.ts` (depende de T014/T010, T024/T025)

## Fase 5: Integração com curtidas — RF-008, RF-009, RF-010

- [x] T027 [P] Estender `tests/integration/services/reactions/create-reaction.service.spec.ts` com o cenário 8: curtida nova notifica o dono do item (`reaction_on_content`); repetir a curtida (idempotente, `add` devolve `false`) não duplica a notificação (D1 do `research.md`) (deve falhar até T029)
- [x] T028 [P] Estender `tests/integration/services/reactions/delete-reaction.service.spec.ts` com o cenário 9: descurtir remove a notificação `reaction_on_content` associada (deve falhar até T030)
- [x] T029 Estender `create-reaction.service.ts` (`src/services/reactions/create-reaction.service.ts`) com dep `createNotification` — só notifica quando `reactionRepository.add(...)` (T006) devolve `true`
- [x] T030 Estender `delete-reaction.service.ts` (`src/services/reactions/delete-reaction.service.ts`) com dep `notificationRepository` — `deleteReactionNotification(activityId, userId)` após `reactionRepository.remove` confirmar `true`
- [x] T031 Passar `createNotification`/`notificationRepository` nas factories de `createReactionService`/`deleteReactionService` em `src/container/register-services.ts` (depende de T014/T010, T029/T030)

## Fase 6: Cascade em lote — RF-010 (`delete-reading-session`/`delete-review`)

- [x] T032 [P] Estender `tests/integration/services/reading-sessions/delete-reading-session.service.spec.ts` com o caso de borda: notificação de qualquer tipo ligado à session (`comment_on_content`/`comment_reply`/`reaction_on_content`) some junto com a session apagada (deve falhar até T034)
- [x] T033 [P] Estender `tests/integration/services/reviews/delete-review.service.spec.ts` com o caso de borda equivalente restrito a `activityType: 'review_published'` (deve falhar até T035)
- [x] T034 Estender `delete-reading-session.service.ts` (`src/services/reading-sessions/delete-reading-session.service.ts`) com dep `notificationRepository` — `deleteByReadingSessionId(sessionId)` após o cascade de `comment`/`reaction` já existente
- [x] T035 Estender `delete-review.service.ts` (`src/services/reviews/delete-review.service.ts`) com dep `notificationRepository` — `deleteByReadingSessionIdAndType(existing.sessionId, 'review_published')` após o cascade já existente
- [x] T036 Passar `notificationRepository` nas factories de `deleteReadingSessionService`/`deleteReviewService` em `src/container/register-services.ts` (depende de T010, T034/T035)

## Fase 7: API de leitura — listar, contar não lidas, marcar como lida (RF-011 a RF-017)

- [x] T037 [P] Teste unitário de `listNotificationsSchema` (`cursor`/`limit` — default 20, limites 1–100) em `tests/unit/schemas/notifications/list-notifications.schema.spec.ts` (deve falhar até T043)
- [x] T038 [P] Teste unitário de `toNotificationDTO` (`read: readAt !== null`; `activityId`/`commentId` nulos preservados conforme o tipo) em `tests/unit/services/notifications/to-dto.spec.ts` (deve falhar até T045)
- [x] T039 [P] Teste de integração de `list-notifications` (ordem descendente mais recente primeiro, paginação por cursor, só notificações do próprio usuário — cenário 11) em `tests/integration/services/notifications/list-notifications.service.spec.ts` (deve falhar até T046)
- [x] T040 [P] Teste de integração de `get-unread-notification-count` (reflete corretamente após criação, leitura e remoção em cascata — cenário 15) em `tests/integration/services/notifications/get-unread-notification-count.service.spec.ts` (deve falhar até T047)
- [x] T041 [P] Teste de integração de `mark-notification-read` (marca como lida — cenário 12; repetir é idempotente, `readAt` original preservado — cenário 14; notificação de outro usuário lança `NotificationNotFoundError`) em `tests/integration/services/notifications/mark-notification-read.service.spec.ts` (deve falhar até T048)
- [x] T042 [P] Teste de integração de `mark-all-notifications-read` (marca todas as não lidas — cenário 13; rodar de novo é idempotente, não altera nada) em `tests/integration/services/notifications/mark-all-notifications-read.service.spec.ts` (deve falhar até T049)
- [x] T043 Schema `listNotificationsSchema` em `src/schemas/notifications/list-notifications.schema.ts` (faz T037 passar)
- [x] T044 `src/schemas/notifications/index.ts` — reexports nomeados (depende de T043)
- [x] T045 `src/services/notifications/types.ts` (`NotificationDTO`, `NotificationCursorPageDTO`, `UnreadNotificationCountDTO`) e `src/services/notifications/to-dto.ts` (`toNotificationDTO`) — faz T038 passar
- [x] T046 Implementar `list-notifications.service.ts` em `src/services/notifications/list-notifications.service.ts` (depende de T045, faz T039 passar)
- [x] T047 Implementar `get-unread-notification-count.service.ts` em `src/services/notifications/get-unread-notification-count.service.ts` (faz T040 passar)
- [x] T048 Implementar `mark-notification-read.service.ts` em `src/services/notifications/mark-notification-read.service.ts` (lança `NotificationNotFoundError` — T001/T002; faz T041 passar)
- [x] T049 Implementar `mark-all-notifications-read.service.ts` em `src/services/notifications/mark-all-notifications-read.service.ts` (faz T042 passar)
- [x] T050 Estender `src/services/notifications/index.ts` (T013) com os 4 services novos e os tipos/`to-dto` (depende de T045-T049)
- [x] T051 Adicionar `ListNotifications`/`GetUnreadNotificationCount`/`MarkNotificationRead`/`MarkAllNotificationsRead` ao `AppCradle` em `src/container/cradle.ts` e registrar os 4 services em `src/container/register-services.ts` (depende de T010, T046-T049)
- [x] T052 Teste de contrato HTTP (`GET /v1/me/notifications`, `GET /v1/me/notifications/unread-count`, `POST /v1/notifications/:notificationId/read`, `POST /v1/notifications/read-all` — 200/204, 400 querystring inválido, 401, 404) em `tests/integration/http/notifications.routes.spec.ts` (deve falhar até T053-T056)
- [x] T053 [P] Controllers `listNotificationsController`/`getUnreadNotificationCountController` em `src/controllers/notifications/list-notifications.controller.ts` e `src/controllers/notifications/get-unread-notification-count.controller.ts`
- [x] T054 [P] Controllers `markNotificationReadController`/`markAllNotificationsReadController` em `src/controllers/notifications/mark-notification-read.controller.ts` e `src/controllers/notifications/mark-all-notifications-read.controller.ts`
- [x] T055 `notificationsRoutes` (plugin Fastify, prefix `/v1`) em `src/controllers/notifications/notifications.routes.ts` e reexports em `src/controllers/notifications/index.ts` (depende de T053/T054)
- [x] T056 Registrar `notificationsRoutes` em `src/app.ts` (depende de T051/T055, faz T052 passar)

## Fase 8: Integração final e polimento

- [x] T057 Rodar `pnpm migrate:up` localmente e confirmar a coleção `notifications` + os 5 índices novos antes de rodar a suíte
- [x] T058 Rodar `pnpm test` (unit + integration) e `pnpm test:coverage`, confirmar gate de 70% em `src/services/notifications/**` e nenhuma regressão nos specs pré-existentes de `follows`/`comments`/`reactions`/`reading-sessions`/`reviews`
- [x] T059 Executar manualmente os passos-chave de `quickstart.md` contra o servidor local (`pnpm dev`) e confirmar cada resultado esperado
- [x] T060 Revisão final: conferir que nenhum novo arquivo importa `mongodb` fora de `repositories/**`, que nenhum `export default` foi introduzido, e que toda chamada a `reactionRepository.add` (agora `Promise<boolean>`) usa o retorno de forma consistente

---

## Dependências

- **Fase 1** (T001-T010) é pré-requisito de todas as outras — erro, migration, `NotificationRepository`
  e a extensão de `ReactionRepository.add` usados no resto. Dentro dela: T001/T003/T004/T005/T007
  são independentes entre si; T002 depende de T001; T006 depende de T004; T008 depende de T007 (e
  faz T005 passar); T009 depende de T007/T008; T010 depende de T008/T009.
- **Fase 2** (T011-T014) depende da Fase 1 (T007/T008, `NotificationRepository`) — não depende das
  Fases 3-7.
- **Fase 3** (T015-T021) depende da Fase 2 (`createNotification`) e do `FollowRequestRepository`/
  `FollowRepository` já existentes (004).
- **Fase 4** (T022-T026) depende da Fase 2 e do `CommentRepository`/`resolveVisibleActivity` já
  existentes (007) — independente da Fase 3 (arquivos/domínios diferentes, pode rodar em paralelo).
- **Fase 5** (T027-T031) depende da Fase 2, da Fase 1 (T006, `ReactionRepository.add` retornando
  `boolean`) e do `resolveVisibleActivity` já existente (007) — independente das Fases 3/4.
- **Fase 6** (T032-T036) depende só da Fase 1 (`NotificationRepository` com os métodos de cascade)
  — não depende das Fases 3/4/5 estarem prontas, só do repository existir.
- **Fase 7** (T037-T056) depende da Fase 1 (`NotificationRepository`) — independente das Fases 3-6
  (nenhum arquivo em comum), pode ser feita em paralelo com elas.
- **Fase 8** depende de todas as anteriores.
- Dentro de cada fase: teste (integração/contrato/unitário) sempre antes da implementação que o
  faz passar (TDD) — ver "deve falhar até T0XX" em cada tarefa de teste.

## Exemplo de execução em paralelo

```
# Fase 1 — erro, migration e testes/interfaces novas não têm dependência entre si:
Tarefa: "T001 Erro NotificationNotFoundError em src/errors/notification-not-found-error.ts"
Tarefa: "T003 Migration create-notifications-collection em migrations/<timestamp>-create-notifications-collection.js"
Tarefa: "T004 Estender teste de ReactionRepository.add (retorno boolean) em tests/integration/repositories/reactions/mongo-reaction.repository.spec.ts"
Tarefa: "T005 Teste de integração do NotificationRepository em tests/integration/repositories/notifications/mongo-notification.repository.spec.ts"
Tarefa: "T007 Interface NotificationRepository em src/repositories/notifications/notification.repository.ts"

# Fases 3, 4 e 5 são domínios independentes depois que a Fase 2 termina:
Tarefa: "T015 Estender teste de send-follow-request em tests/integration/services/follows/send-follow-request.service.spec.ts"
Tarefa: "T022 Estender teste de create-comment em tests/integration/services/comments/create-comment.service.spec.ts"
Tarefa: "T027 Estender teste de create-reaction em tests/integration/services/reactions/create-reaction.service.spec.ts"

# Fase 7 — os 6 testes novos de notifications são independentes entre si:
Tarefa: "T037 Teste unitário de listNotificationsSchema em tests/unit/schemas/notifications/list-notifications.schema.spec.ts"
Tarefa: "T039 Teste de integração de list-notifications em tests/integration/services/notifications/list-notifications.service.spec.ts"
Tarefa: "T041 Teste de integração de mark-notification-read em tests/integration/services/notifications/mark-notification-read.service.spec.ts"
```

## Notas

- `[P]` = arquivos diferentes, sem dependências entre as tarefas marcadas.
- Caminhos de arquivo/pasta e identificadores nas tarefas sempre em **inglês** (regra fixa do
  kit); a descrição da tarefa fica em português.
- Cada teste de integração/contrato/unitário deve existir e **falhar** antes da tarefa de
  implementação correspondente ser feita.
- Commitar após cada tarefa concluída.
- Nenhuma tarefa aqui ficou bloqueada por informação faltando em `plan.md`/`data-model.md` — a
  entidade `Notification`, os 4 endpoints, o erro novo e as 9 extensões de service existente já
  tinham assinatura completa nos artefatos da Fase 1 do `/plan`.
