# Fase 1 — Modelo de Dados: Fluxo de notificações

Feature: `008-notificationflow` · Data: 2026-09-05

Todos os identificadores em inglês (regra fixa do kit). Persistência via MongoDB; toda criação de
coleção/índice vem de uma migration `migrate-mongo` (P4). Nenhum acesso ao driver fora de
`src/repositories/**` e `src/db/**` (P2).

---

## Notification

Registro persistido de um evento relevante para um usuário (glossário de `product.md`). Coleção
`notifications`. Nunca é editada depois de criada, exceto o campo `readAt` (marcar como lida) —
sem update de conteúdo.

| Campo | Tipo | Obrigatório | Regra / origem |
|---|---|---|---|
| `_id` | `ObjectId` | sim | gerado pelo Mongo; exposto às camadas como `id: string` (hex) |
| `recipientId` | `string` | sim | dono da notificação (referência a `users._id`) — quem vê e marca como lida |
| `type` | `'follow_request' \| 'follow_approved' \| 'comment_on_content' \| 'comment_reply' \| 'reaction_on_content'` | sim | tipo do evento (RF-001, RF-002, RF-005, RF-006, RF-008) |
| `actorId` | `string` | sim | quem originou o evento (referência a `users._id`) — quem pediu o follow, aprovou, comentou, respondeu, ou curtiu |
| `activityId` | `string \| null` | não | referência a `activities._id` — o item de feed alvo; preenchido só em `comment_on_content`, `comment_reply`, `reaction_on_content` (RF-005, RF-006, RF-008); `null` nos 2 tipos de follow |
| `commentId` | `string \| null` | não | referência a `comments._id` — o comentário/resposta específico que originou o evento; preenchido só em `comment_on_content` e `comment_reply` (usado por `deleteByCommentId`, RF-010); `null` nos demais tipos |
| `readingSessionId` | `string \| null` | não | denormalizado da `Activity` de origem, só para cascade de deleção (D5 do `research.md`); preenchido nos mesmos 3 tipos que têm `activityId`; `null` nos 2 tipos de follow |
| `activityType` | `'started_reading' \| 'finished_reading' \| 'review_published' \| 'progress_update' \| null` | não | denormalizado da `Activity` de origem, só para cascade (D5); mesmo padrão de `readingSessionId` |
| `readAt` | `Date \| null` | não | `null` até o destinatário marcar como lida (RF-013, RF-014); idempotente — marcar de novo não sobrescreve um valor já existente (RF-015) |
| `createdAt` | `Date` | sim | instante de criação; chave de ordenação/cursor (ordem descendente — mais recente primeiro, RF-011) |

**Índices** (migration `create-notifications-collection`):
- `{ recipientId: 1, createdAt: -1, _id: -1 }` — página por cursor descendente da lista do usuário (RF-011)
- `{ recipientId: 1, readAt: 1 }` — contagem de não lidas e "marcar todas como lidas", ambos filtram `readAt: null` (RF-014, RF-016)
- `{ recipientId: 1, actorId: 1, type: 1, activityId: 1 }` — remoção por chave de `follow_request` e de `reaction_on_content` (D2 do `research.md`)
- `{ commentId: 1 }`, parcial (`partialFilterExpression: { commentId: { $type: 'string' } }`) — remoção por `deleteByCommentId` (D6); parcial porque só ~2 dos 5 tipos preenchem esse campo
- `{ readingSessionId: 1, activityType: 1 }`, parcial (`partialFilterExpression: { readingSessionId: { $type: 'string' } }`) — cascade de `delete-reading-session`/`delete-review` (D5); parcial pelo mesmo motivo do índice de `commentId`

**Regras**:
- `create(input, now)`: insere um documento; `input` traz `recipientId`, `type`, `actorId`, e os
  campos opcionais (`activityId`, `commentId`, `readingSessionId`, `activityType`) conforme o tipo.
  Nunca falha por duplicidade — não há índice único (múltiplas notificações do mesmo par são
  esperadas para `comment_on_content`/`comment_reply`, já que cada comentário é um evento próprio).
- `findById(notificationId)`: usado por `mark-notification-read` para checar posse
  (`recipientId === userId`) e o estado atual de `readAt` antes de decidir se escreve (RF-012,
  RF-015).
- `listByRecipient(recipientId, cursor, limit)`: página por cursor descendente
  (`createdAt`/`_id`), filtrada por `recipientId` (RF-011, RF-012).
- `markRead(notificationId, readAt)`: `$set` de `readAt`; só chamado depois que o service já
  confirmou posse e que `readAt` ainda era `null` (idempotência é responsabilidade do service,
  RF-015 — ver `mark-notification-read.service.ts` abaixo).
- `markAllRead(recipientId, readAt)`: `updateMany({ recipientId, readAt: null }, { $set: { readAt } })`;
  devolve quantos documentos foram atualizados (RF-014); idempotente por natureza do filtro
  (`readAt: null` — rodar de novo não encontra nada para atualizar).
- `countUnread(recipientId)`: `countDocuments({ recipientId, readAt: null })` (RF-016).
- `deleteFollowRequestNotification(recipientId, actorId)`: remove o documento
  `{ recipientId, actorId, type: 'follow_request' }` — cascade de `approve-follow-request` e
  `reject-follow-request` (RF-003, RF-004, D2).
- `deleteReactionNotification(activityId, actorId)`: remove o documento
  `{ activityId, actorId, type: 'reaction_on_content' }` — cascade de `delete-reaction` (RF-010, D2).
- `deleteByCommentId(commentId)`: remove todo documento com aquele `commentId` (0, 1 ou 2 —
  `comment_on_content` e/ou `comment_reply` do mesmo comentário) — cascade de `delete-comment`
  (RF-010, D6).
- `deleteByReadingSessionId(readingSessionId)`: remove toda notificação ligada àquela session,
  qualquer `activityType` — cascade de `delete-reading-session` (RF-010, D5).
- `deleteByReadingSessionIdAndType(readingSessionId, activityType)`: remove só as notificações do
  tipo de activity indicado naquela session — cascade de `delete-review` com
  `activityType = 'review_published'` (RF-010, D5).

---

## Extensão de repositório existente

### `ReactionRepository.add` (007, alterado) — passa a devolver `Promise<boolean>`

```ts
export interface ReactionRepository {
  /**
   * Idempotent upsert keyed by `{ activityId, userId }`. Returns `true` when this call actually
   * inserted a new reaction (D1 of research.md) — used by `create-reaction.service.ts` to only
   * notify on a genuinely new reaction, never on a repeated idempotent call.
   */
  add(
    activityId: string,
    userId: string,
    readingSessionId: string,
    activityType: ActivityType,
    now: Date,
  ): Promise<boolean>;

  // ...demais métodos (007), inalterados...
}
```

`MongoReactionRepository.add` passa a retornar `result.upsertedCount > 0`, onde `result` é o
`UpdateResult` que o próprio `updateOne({ ... }, { upsert: true })` já devolve — nenhuma consulta
extra (D1 do `research.md`).

---

## Serviço novo compartilhado — `createNotification`

`src/services/notifications/create-notification.ts` (sem rota HTTP própria — só reuso interno,
D4 do `research.md`).

```ts
export interface CreateNotificationInput {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  activityId?: string | null;
  commentId?: string | null;
  readingSessionId?: string | null;
  activityType?: ActivityType | null;
}

export type CreateNotification = (input: CreateNotificationInput) => Promise<void>;

export interface CreateNotificationDeps {
  notificationRepository: NotificationRepository;
  clock: Clock;
}
```

Fluxo (D4 do `research.md`): se `input.recipientId === input.actorId` → não faz nada (sem
auto-notificação, RF-009) → senão `notificationRepository.create({ ... }, clock.now())`.

Consumido por `send-follow-request`, `approve-follow-request`, `create-comment` (até 2 vezes por
chamada, D3), `create-reaction`.

---

## Extensões de services existentes

### `send-follow-request.service.ts` (004, alterado)

`SendFollowRequestDeps` ganha `createNotification: CreateNotification`. Depois de resolver
`created` (já existente): se `created === true`, chama
`createNotification({ recipientId: targetId, actorId: requesterId, type: 'follow_request' })`
(RF-001, D1).

### `approve-follow-request.service.ts` (004, alterado)

`ApproveFollowRequestDeps` ganha `notificationRepository: NotificationRepository` e
`createNotification: CreateNotification`. Depois de `followRepository.create(...)` (já existente):

```ts
await notificationRepository.deleteFollowRequestNotification(targetId, requesterId);
await createNotification({ recipientId: requesterId, actorId: targetId, type: 'follow_approved' });
```

(RF-002, RF-004, D2)

### `reject-follow-request.service.ts` (004, alterado)

`RejectFollowRequestDeps` ganha `notificationRepository: NotificationRepository`. Depois de
`followRequestRepository.deleteByPair(...)` (já existente):

```ts
await notificationRepository.deleteFollowRequestNotification(targetId, requesterId);
```

Nenhuma notificação nova é criada (RF-003, RF-004, D2).

### `create-comment.service.ts` (007, alterado)

`CreateCommentDeps` ganha `createNotification: CreateNotification`. Depois de
`commentRepository.create(...)` (já existente), com o `parent` já resolvido quando
`parentCommentId` foi informado (RF-005 a RF-007, D3):

```ts
const base = {
  activityId,
  commentId: record.id,
  readingSessionId: activity.readingSessionId,
  activityType: activity.type,
};

let notifyItemOwner = true;
if (parentCommentId) {
  await createNotification({ ...base, recipientId: parent.authorId, actorId: userId, type: 'comment_reply' });
  if (parent.authorId === activity.actorId) {
    notifyItemOwner = false; // dedup RF-007
  }
}
if (notifyItemOwner) {
  await createNotification({ ...base, recipientId: activity.actorId, actorId: userId, type: 'comment_on_content' });
}
```

### `delete-comment.service.ts` (007, alterado)

`DeleteCommentDeps` ganha `notificationRepository: NotificationRepository`. Depois de
`commentRepository.softDelete(...)` (já existente):

```ts
await notificationRepository.deleteByCommentId(commentId);
```

(RF-010, D6)

### `create-reaction.service.ts` (007, alterado)

`CreateReactionDeps` ganha `createNotification: CreateNotification`. Depois de
`reactionRepository.add(...)` (já existente, agora retornando `boolean`):

```ts
const createdNow = await reactionRepository.add(activityId, userId, activity.readingSessionId, activity.type, clock.now());
if (createdNow) {
  await createNotification({
    recipientId: activity.actorId,
    actorId: userId,
    type: 'reaction_on_content',
    activityId,
    readingSessionId: activity.readingSessionId,
    activityType: activity.type,
  });
}
```

(RF-008, D1)

### `delete-reaction.service.ts` (007, alterado)

`DeleteReactionDeps` ganha `notificationRepository: NotificationRepository`. Depois de
`reactionRepository.remove(...)` confirmar `true` (já existente):

```ts
await notificationRepository.deleteReactionNotification(activityId, userId);
```

(RF-010, D2/D6)

### `delete-reading-session.service.ts` (003, alterado)

`DeleteReadingSessionDeps` ganha `notificationRepository: NotificationRepository`. Depois de
`reactionRepository.deleteByReadingSessionId(sessionId)` (já existente, 007):

```ts
await notificationRepository.deleteByReadingSessionId(sessionId);
```

(RF-010, D5)

### `delete-review.service.ts` (005, alterado)

`DeleteReviewDeps` ganha `notificationRepository: NotificationRepository`. Depois de
`reactionRepository.deleteByReadingSessionIdAndType(existing.sessionId, 'review_published')` (já
existente, 007):

```ts
await notificationRepository.deleteByReadingSessionIdAndType(existing.sessionId, 'review_published');
```

(RF-010, D5)

---

## Services novos — domínio `notifications`

### `src/services/notifications/list-notifications.service.ts`

```ts
export interface ListNotificationsInput {
  userId: string;
  cursor: string | null;
  limit: number;
}

export type ListNotifications = (input: ListNotificationsInput) => Promise<NotificationCursorPageDTO>;
```

Fluxo (RF-011, RF-012): `notificationRepository.listByRecipient(userId, cursor, limit)` → mapeia
cada item para `NotificationDTO` via `toNotificationDTO`.

### `src/services/notifications/get-unread-notification-count.service.ts`

```ts
export type GetUnreadNotificationCount = (userId: string) => Promise<number>;
```

Fluxo (RF-016): `notificationRepository.countUnread(userId)`.

### `src/services/notifications/mark-notification-read.service.ts`

```ts
export interface MarkNotificationReadInput {
  userId: string;
  notificationId: string;
}

export type MarkNotificationRead = (input: MarkNotificationReadInput) => Promise<void>;
```

Fluxo (RF-013, RF-012, RF-015): `notificationRepository.findById(notificationId)` → se `null` ou
`recipientId !== userId` → `NotificationNotFoundError` → se `readAt !== null` já, retorna sem
escrever (idempotente) → senão `notificationRepository.markRead(notificationId, clock.now())`.

### `src/services/notifications/mark-all-notifications-read.service.ts`

```ts
export type MarkAllNotificationsRead = (userId: string) => Promise<void>;
```

Fluxo (RF-014, RF-015): `notificationRepository.markAllRead(userId, clock.now())` — o filtro
`readAt: null` já torna a operação idempotente (rodar de novo não atualiza nada).

---

## DTOs de resposta (camada HTTP)

```ts
export interface NotificationDTO {
  id: string;
  type: NotificationType;
  actorId: string;
  activityId: string | null;
  commentId: string | null;
  read: boolean;          // readAt !== null
  createdAt: string;
}

export interface NotificationCursorPageDTO {
  items: NotificationDTO[];
  nextCursor: string | null;
}

export interface UnreadNotificationCountDTO {
  count: number;
}
```

---

## Erros novos

| Classe | `code` | HTTP | Quando |
|---|---|---|---|
| `NotificationNotFoundError` | `NOTIFICATION_NOT_FOUND` | 404 | `notificationId` não existe, ou existe mas não pertence ao usuário autenticado (RF-012, RF-013) |

Estende `AppError` (princípio "Erros tipados com hierarquia a partir de um tipo base").
