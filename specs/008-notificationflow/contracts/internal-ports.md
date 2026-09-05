# Contratos internos (ports) — Fluxo de notificações

Interfaces TypeScript que as camadas expõem umas às outras. Nomes em inglês; caminhos seguem
`.specify/memory/architecture.md`. Fluxo unidirecional: controller → service → repository; só
`repositories/**`, `db/**` tocam o driver `mongodb`.

---

## `NotificationRepository` — `src/repositories/notifications/notification.repository.ts` (NOVO)

Port de acesso a `notifications`. Registro Awilix: `notificationRepository`.

```ts
export type NotificationType =
  | 'follow_request'
  | 'follow_approved'
  | 'comment_on_content'
  | 'comment_reply'
  | 'reaction_on_content';

export interface NotificationRecord {
  id: string;
  recipientId: string;
  type: NotificationType;
  actorId: string;
  activityId: string | null;
  commentId: string | null;
  readingSessionId: string | null;
  activityType: ActivityType | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface CreateNotificationRecordInput {
  recipientId: string;
  type: NotificationType;
  actorId: string;
  activityId?: string | null;
  commentId?: string | null;
  readingSessionId?: string | null;
  activityType?: ActivityType | null;
}

export interface NotificationRepository {
  create(input: CreateNotificationRecordInput, now: Date): Promise<NotificationRecord>;

  findById(notificationId: string): Promise<NotificationRecord | null>;

  /** Página por cursor DESCENDENTE (`createdAt`/`_id`) — mais recente primeiro (RF-011). */
  listByRecipient(recipientId: string, cursor: string | null, limit: number): Promise<CursorPage<NotificationRecord>>;

  /** `$set` de `readAt`. Idempotência é responsabilidade do service (RF-015). */
  markRead(notificationId: string, readAt: Date): Promise<void>;

  /** `updateMany({ recipientId, readAt: null })`; devolve quantos documentos foram atualizados. */
  markAllRead(recipientId: string, readAt: Date): Promise<number>;

  /** `countDocuments({ recipientId, readAt: null })` (RF-016). */
  countUnread(recipientId: string): Promise<number>;

  /** Remove o documento `follow_request` desse par — cascade de aprovar/recusar (RF-004, D2). */
  deleteFollowRequestNotification(recipientId: string, actorId: string): Promise<void>;

  /** Remove o documento `reaction_on_content` dessa chave — cascade de descurtir (RF-010, D2). */
  deleteReactionNotification(activityId: string, actorId: string): Promise<void>;

  /** Remove toda notificação (`comment_on_content`/`comment_reply`) ligada a esse comentário (RF-010, D6). */
  deleteByCommentId(commentId: string): Promise<void>;

  /** Remove toda notificação de uma session, qualquer `activityType` — cascade (RF-010, D5). */
  deleteByReadingSessionId(readingSessionId: string): Promise<void>;

  /** Remove só as notificações do `activityType` indicado numa session — cascade (RF-010, D5). */
  deleteByReadingSessionIdAndType(readingSessionId: string, activityType: ActivityType): Promise<void>;
}
```

---

## `ReactionRepository` — `src/repositories/reactions/reaction.repository.ts` (007, alterado)

Único método alterado — muda o tipo de retorno:

```ts
export interface ReactionRepository {
  /**
   * Idempotent upsert keyed by `{ activityId, userId }`. Returns `true` when this call actually
   * inserted a new reaction, `false` quando já existia (D1 do research.md — usado por
   * `create-reaction.service.ts` para só notificar numa curtida genuinamente nova).
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

---

## Serviço novo compartilhado — `src/services/notifications/create-notification.ts`

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

Fluxo (D4 do `research.md`): `recipientId === actorId` → não faz nada (RF-009) → senão
`notificationRepository.create({ ... }, clock.now())`.

Sem controller/rota própria. Registro Awilix: `createNotificationService`.

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

export interface ListNotificationsDeps {
  notificationRepository: NotificationRepository;
}
```

Fluxo (RF-011, RF-012): `notificationRepository.listByRecipient(userId, cursor, limit)` → mapeia
para `NotificationDTO`.

### `src/services/notifications/get-unread-notification-count.service.ts`

```ts
export type GetUnreadNotificationCount = (userId: string) => Promise<number>;

export interface GetUnreadNotificationCountDeps {
  notificationRepository: NotificationRepository;
}
```

Fluxo (RF-016): `notificationRepository.countUnread(userId)`.

### `src/services/notifications/mark-notification-read.service.ts`

```ts
export interface MarkNotificationReadInput {
  userId: string;
  notificationId: string;
}

export type MarkNotificationRead = (input: MarkNotificationReadInput) => Promise<void>;

export interface MarkNotificationReadDeps {
  notificationRepository: NotificationRepository;
  clock: Clock;
}
```

Fluxo (RF-012, RF-013, RF-015): `findById` → `null`/dono errado → `NotificationNotFoundError` →
`readAt !== null` → retorna (no-op) → senão `markRead(notificationId, clock.now())`.

### `src/services/notifications/mark-all-notifications-read.service.ts`

```ts
export type MarkAllNotificationsRead = (userId: string) => Promise<void>;

export interface MarkAllNotificationsReadDeps {
  notificationRepository: NotificationRepository;
  clock: Clock;
}
```

Fluxo (RF-014, RF-015): `notificationRepository.markAllRead(userId, clock.now())`.

---

## Controllers/rotas novos

```ts
// src/controllers/notifications/notifications.routes.ts (prefix '/v1')
app.get('/me/notifications', { preHandler: app.authenticate }, listNotificationsController);
app.get('/me/notifications/unread-count', { preHandler: app.authenticate }, getUnreadNotificationCountController);
app.post('/notifications/:notificationId/read', { preHandler: app.authenticate }, markNotificationReadController);
app.post('/notifications/read-all', { preHandler: app.authenticate }, markAllNotificationsReadController);
```

Status codes: `listNotificationsController` → `200` + `NotificationCursorPageDTO`.
`getUnreadNotificationCountController` → `200` + `UnreadNotificationCountDTO`.
`markNotificationReadController` → `204` (idempotente, sem corpo). `markAllNotificationsReadController`
→ `204` (idempotente, sem corpo).

`src/schemas/notifications/list-notifications.schema.ts`:

```ts
export const listNotificationsSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

Sem schema de corpo para as outras 3 rotas (nenhuma tem body).

---

## Extensões de services existentes

### `send-follow-request.service.ts` (004, alterado)

`SendFollowRequestDeps` ganha `createNotification: CreateNotification`. Depois de resolver
`created`:

```ts
if (created) {
  await createNotification({ recipientId: targetId, actorId: requesterId, type: 'follow_request' });
}
```

### `approve-follow-request.service.ts` (004, alterado)

`ApproveFollowRequestDeps` ganha `notificationRepository: NotificationRepository` e
`createNotification: CreateNotification`. Depois de `followRepository.create(...)`:

```ts
await notificationRepository.deleteFollowRequestNotification(targetId, requesterId);
await createNotification({ recipientId: requesterId, actorId: targetId, type: 'follow_approved' });
```

### `reject-follow-request.service.ts` (004, alterado)

`RejectFollowRequestDeps` ganha `notificationRepository: NotificationRepository`. Depois de
`followRequestRepository.deleteByPair(...)`:

```ts
await notificationRepository.deleteFollowRequestNotification(targetId, requesterId);
```

### `create-comment.service.ts` (007, alterado)

`CreateCommentDeps` ganha `createNotification: CreateNotification`. Depois de
`commentRepository.create(...)`:

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
    notifyItemOwner = false;
  }
}
if (notifyItemOwner) {
  await createNotification({ ...base, recipientId: activity.actorId, actorId: userId, type: 'comment_on_content' });
}
```

### `delete-comment.service.ts` (007, alterado)

`DeleteCommentDeps` ganha `notificationRepository: NotificationRepository`. Depois de
`commentRepository.softDelete(...)`:

```ts
await notificationRepository.deleteByCommentId(commentId);
```

### `create-reaction.service.ts` (007, alterado)

`CreateReactionDeps` ganha `createNotification: CreateNotification`. `reactionRepository.add(...)`
agora retorna `boolean`:

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

### `delete-reaction.service.ts` (007, alterado)

`DeleteReactionDeps` ganha `notificationRepository: NotificationRepository`. Depois de
`reactionRepository.remove(...)` confirmar `true`:

```ts
await notificationRepository.deleteReactionNotification(activityId, userId);
```

### `delete-reading-session.service.ts` (003, alterado)

`DeleteReadingSessionDeps` ganha `notificationRepository: NotificationRepository`. Depois de
`reactionRepository.deleteByReadingSessionId(sessionId)`:

```ts
await notificationRepository.deleteByReadingSessionId(sessionId);
```

### `delete-review.service.ts` (005, alterado)

`DeleteReviewDeps` ganha `notificationRepository: NotificationRepository`. Depois de
`reactionRepository.deleteByReadingSessionIdAndType(existing.sessionId, 'review_published')`:

```ts
await notificationRepository.deleteByReadingSessionIdAndType(existing.sessionId, 'review_published');
```

---

## Container (Awilix)

`register-repositories.ts` ganha `notificationRepository` (implementação
`MongoNotificationRepository`). `register-services.ts` ganha `createNotificationService`,
`listNotificationsService`, `getUnreadNotificationCountService`, `markNotificationReadService`,
`markAllNotificationsReadService`; os registros existentes de `sendFollowRequestService`,
`approveFollowRequestService`, `rejectFollowRequestService`, `createCommentService`,
`deleteCommentService`, `createReactionService`, `deleteReactionService`,
`deleteReadingSessionService` e `deleteReviewService` continuam com o mesmo nome, só ganham as
novas deps (`notificationRepository` e/ou `createNotification: cradle.createNotificationService`)
na factory.
