# Contratos internos (ports) — Interações (comentar e curtir)

Interfaces TypeScript que as camadas expõem umas às outras. Nomes em inglês; caminhos seguem
`.specify/memory/architecture.md`. Fluxo unidirecional: controller → service → repository; só
`repositories/**`, `db/**` tocam o driver `mongodb`.

---

## `CommentRepository` — `src/repositories/comments/comment.repository.ts` (NOVO)

Port de acesso a `comments`. Registro Awilix: `commentRepository`.

```ts
export interface CommentRecord {
  id: string;
  activityId: string;
  readingSessionId: string;
  activityType: ActivityType;
  authorId: string;
  text: string;
  parentCommentId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
}

export interface CreateCommentInput {
  activityId: string;
  readingSessionId: string;
  activityType: ActivityType;
  authorId: string;
  text: string;
  parentCommentId?: string | null;
}

export interface CommentRepository {
  create(input: CreateCommentInput, now: Date): Promise<CommentRecord>;

  findById(commentId: string): Promise<CommentRecord | null>;

  /** Página por cursor ASCENDENTE (`createdAt`/`_id`) de um item (RF-008, D5 do research.md). */
  listByActivity(activityId: string, cursor: string | null, limit: number): Promise<CursorPage<CommentRecord>>;

  /** `$set` de `deletedAt`; não apaga o documento nem o `text` (RF-009). */
  softDelete(commentId: string, deletedAt: Date): Promise<CommentRecord | null>;

  /** Remove todos os comentários de uma session, qualquer `activityType` — cascade (RF-013). */
  deleteByReadingSessionId(readingSessionId: string): Promise<void>;

  /** Remove só os comentários de um `activityType` numa session — cascade (RF-013). */
  deleteByReadingSessionIdAndType(readingSessionId: string, activityType: ActivityType): Promise<void>;
}
```

---

## `ReactionRepository` — `src/repositories/reactions/reaction.repository.ts` (NOVO)

Port de acesso a `reactions`. Registro Awilix: `reactionRepository`.

```ts
export interface ReactionRecord {
  id: string;
  activityId: string;
  readingSessionId: string;
  activityType: ActivityType;
  userId: string;
  createdAt: Date;
}

export interface ReactionRepository {
  /** Upsert idempotente por `{ activityId, userId }` — repetir não duplica (RF-002, D4). */
  add(
    activityId: string,
    userId: string,
    readingSessionId: string,
    activityType: ActivityType,
    now: Date,
  ): Promise<void>;

  /** `true` se algo foi de fato removido (RF-003 — `ReactionNotFoundError` se `false`). */
  remove(activityId: string, userId: string): Promise<boolean>;

  /** Contagem por item, em lote — usado pelo feed (D7). */
  countByActivityIds(activityIds: string[]): Promise<Map<string, number>>;

  /** Quais desses `activityIds` o `userId` já curtiu — usado pelo feed (D7). */
  listReactedActivityIds(userId: string, activityIds: string[]): Promise<string[]>;

  deleteByReadingSessionId(readingSessionId: string): Promise<void>;

  deleteByReadingSessionIdAndType(readingSessionId: string, activityType: ActivityType): Promise<void>;
}
```

---

## `ActivityRepository` — `src/repositories/activities/activity.repository.ts` (006, alterado)

Um método novo:

```ts
export interface ActivityRepository {
  // ...métodos existentes (006), inalterados...

  /** Resolve o alvo de um comentário/curtida (D1 do research.md). */
  findById(activityId: string): Promise<ActivityRecord | null>;
}
```

---

## Service novo compartilhado — `src/services/activities/resolve-visible-activity.ts`

```ts
export interface ResolveVisibleActivityDeps {
  activityRepository: ActivityRepository;
  followRepository: FollowRepository;
}

export type ResolveVisibleActivity = (activityId: string, viewerId: string) => Promise<ActivityRecord>;
```

Fluxo (D1/D2 do `research.md`): `findById` → `ActivityNotFoundError` se `null` ou se
`viewerId` não é o dono e não segue aprovado o dono → `UnsupportedActivityInteractionError` se
`type === 'started_reading'` → retorna o `ActivityRecord`.

Sem controller/rota própria. Registro Awilix: `resolveVisibleActivityService`.

---

## Services novos — domínio `comments`

### `src/services/comments/create-comment.service.ts`

```ts
export interface CreateCommentInput {
  userId: string;
  activityId: string;
  text: string;
  parentCommentId?: string | null;
}

export type CreateComment = (input: CreateCommentInput) => Promise<CommentDTO>;

export interface CreateCommentDeps {
  commentRepository: CommentRepository;
  resolveVisibleActivity: ResolveVisibleActivity;
  clock: Clock;
}
```

Fluxo (RF-005 a RF-007, RF-010, RF-014): `resolveVisibleActivity(activityId, userId)` → se
`parentCommentId` informado: `commentRepository.findById(parentCommentId)`; se `null` ou
`parent.activityId !== activityId` → `CommentNotFoundError`; se `parent.parentCommentId !== null`
→ `CommentNestingTooDeepError` → `commentRepository.create({ activityId, readingSessionId:
activity.readingSessionId, activityType: activity.type, authorId: userId, text, parentCommentId },
clock.now())` → `toCommentDTO`.

### `src/services/comments/list-comments.service.ts`

```ts
export interface ListCommentsInput {
  userId: string;
  activityId: string;
  cursor: string | null;
  limit: number;
}

export type ListComments = (input: ListCommentsInput) => Promise<CommentCursorPageDTO>;

export interface ListCommentsDeps {
  commentRepository: CommentRepository;
  resolveVisibleActivity: ResolveVisibleActivity;
}
```

Fluxo (RF-008, RF-012): `resolveVisibleActivity(activityId, userId)` (só para validar acesso —
resultado descartado) → `commentRepository.listByActivity(activityId, cursor, limit)` → mapeia
cada item para `CommentDTO` (`text: '[removido]'` quando `deletedAt !== null`).

### `src/services/comments/delete-comment.service.ts`

```ts
export interface DeleteCommentInput {
  userId: string;
  commentId: string;
}

export type DeleteComment = (input: DeleteCommentInput) => Promise<void>;

export interface DeleteCommentDeps {
  commentRepository: CommentRepository;
  clock: Clock;
}
```

Fluxo (RF-009, D6 do research.md): `commentRepository.findById(commentId)` → se `null` ou
`authorId !== userId` → `CommentNotFoundError` → `commentRepository.softDelete(commentId, clock.now())`.

---

## Services novos — domínio `reactions`

### `src/services/reactions/create-reaction.service.ts`

```ts
export interface CreateReactionInput {
  userId: string;
  activityId: string;
}

export type CreateReaction = (input: CreateReactionInput) => Promise<void>;

export interface CreateReactionDeps {
  reactionRepository: ReactionRepository;
  resolveVisibleActivity: ResolveVisibleActivity;
  clock: Clock;
}
```

Fluxo (RF-001, RF-002, RF-014): `resolveVisibleActivity(activityId, userId)` →
`reactionRepository.add(activityId, userId, activity.readingSessionId, activity.type, clock.now())`.

### `src/services/reactions/delete-reaction.service.ts`

```ts
export interface DeleteReactionInput {
  userId: string;
  activityId: string;
}

export type DeleteReaction = (input: DeleteReactionInput) => Promise<void>;

export interface DeleteReactionDeps {
  reactionRepository: ReactionRepository;
  resolveVisibleActivity: ResolveVisibleActivity;
}
```

Fluxo (RF-003): `resolveVisibleActivity(activityId, userId)` → `reactionRepository.remove(activityId, userId)`
→ se `false` → `ReactionNotFoundError`.

---

## Controllers/rotas novos

```ts
// src/controllers/comments/comments.routes.ts (prefix '/v1')
app.post('/activities/:activityId/comments', { preHandler: app.authenticate }, createCommentController);
app.get('/activities/:activityId/comments', { preHandler: app.authenticate }, listCommentsController);
app.delete('/comments/:commentId', { preHandler: app.authenticate }, deleteCommentController);

// src/controllers/reactions/reactions.routes.ts (prefix '/v1')
app.post('/activities/:activityId/reactions', { preHandler: app.authenticate }, createReactionController);
app.delete('/activities/:activityId/reactions', { preHandler: app.authenticate }, deleteReactionController);
```

Status codes: `createCommentController` → `201` + `CommentDTO`. `listCommentsController` → `200` +
`CommentCursorPageDTO`. `deleteCommentController` → `204`. `createReactionController` → `204`
(idempotente — sem corpo, mesmo raciocínio de `unfollow`/`remove-follower`, que também são `204`
sem distinguir "criou agora" de "já existia", já que RF-002 não pede um sinal `created`).
`deleteReactionController` → `204`.

`src/schemas/comments/create-comment.schema.ts`:

```ts
export const createCommentSchema = z.object({
  text: z.string().trim().min(1),
  parentCommentId: z.string().min(1).optional(),
});
```

`src/schemas/comments/list-comments.schema.ts`:

```ts
export const listCommentsSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

Sem schema de corpo para `reactions` (ambas as rotas não têm body).

---

## Extensões de services existentes

### `delete-reading-session.service.ts` (003, alterado)

`DeleteReadingSessionDeps` ganha `commentRepository: CommentRepository` e
`reactionRepository: ReactionRepository`. Depois de `activityRepository.deleteBySessionId(sessionId)`:

```ts
await commentRepository.deleteByReadingSessionId(sessionId);
await reactionRepository.deleteByReadingSessionId(sessionId);
```

### `delete-review.service.ts` (005, alterado)

`DeleteReviewDeps` ganha `commentRepository: CommentRepository` e
`reactionRepository: ReactionRepository`. Depois de
`activityRepository.deleteBySessionIdAndType(existing.sessionId, 'review_published')`:

```ts
await commentRepository.deleteByReadingSessionIdAndType(existing.sessionId, 'review_published');
await reactionRepository.deleteByReadingSessionIdAndType(existing.sessionId, 'review_published');
```

### `get-feed.service.ts` (006, alterado)

`GetFeedDeps` ganha `reactionRepository: ReactionRepository`. Depois de montar `actorIds`/`bookIds`
únicos da página, em paralelo com os `Promise.all` já existentes:

```ts
const activityIds = page.items.map((item) => item.id);
const [reactionCounts, reactedActivityIds] = await Promise.all([
  reactionRepository.countByActivityIds(activityIds),
  reactionRepository.listReactedActivityIds(userId, activityIds),
]);
const reactedSet = new Set(reactedActivityIds);
```

Cada `FeedItemDTO` ganha `reactionsCount: reactionCounts.get(activity.id) ?? 0` e
`hasReacted: reactedSet.has(activity.id)`.

---

## Container (Awilix)

`register-repositories.ts` ganha `commentRepository`/`reactionRepository` (implementações
`MongoCommentRepository`/`MongoReactionRepository`). `register-services.ts` ganha
`resolveVisibleActivityService`, `createCommentService`, `listCommentsService`,
`deleteCommentService`, `createReactionService`, `deleteReactionService`; os registros existentes
de `deleteReadingSessionService`, `deleteReviewService` e `getFeedService` continuam com o mesmo
nome, só ganham as novas deps na factory.
