# Contratos internos (ports) — Feed de atividade

Interfaces TypeScript que as camadas expõem umas às outras. Nomes em inglês; caminhos seguem
`.specify/memory/architecture.md`. Fluxo unidirecional: controller → service → repository; só
`repositories/**`, `db/**` tocam o driver `mongodb`.

---

## `ActivityRepository` — `src/repositories/activities/activity.repository.ts` (NOVO)

Port de acesso a `activities`. Registro Awilix: `activityRepository`.

```ts
export type ActivityType = 'started_reading' | 'finished_reading' | 'review_published' | 'progress_update';

export interface ActivityRecord {
  id: string;
  type: ActivityType;
  actorId: string;
  bookId: string;
  readingSessionId: string;
  currentPage: number | null;
  createdAt: Date;
}

export interface RecordActivityInput {
  type: ActivityType;
  actorId: string;
  bookId: string;
  readingSessionId: string;
  currentPage?: number;
}

export interface ActivityRepository {
  /** Insere um evento; `now` vem do `Clock` injetado no service chamador (D7, mesmo padrão de `FollowRecord.createdAt`). */
  record(input: RecordActivityInput, now: Date): Promise<ActivityRecord>;

  /** Página por cursor, `actorId: { $in: actorIds }`, ordenada `createdAt` desc (RF-006/007/008, D7 do research.md). */
  listForActors(actorIds: string[], cursor: string | null, limit: number): Promise<CursorPage<ActivityRecord>>;

  /** Remove todos os eventos de uma session, qualquer tipo — cascade de `delete-reading-session` (D4). */
  deleteBySessionId(readingSessionId: string): Promise<void>;

  /** Remove só os eventos de um tipo numa session — cascade de `delete-review` (D4). */
  deleteBySessionIdAndType(readingSessionId: string, type: ActivityType): Promise<void>;
}
```

---

## `FollowRepository` — `src/repositories/follows/follow.repository.ts` (004, alterado)

Um método novo:

```ts
export interface FollowRepository {
  // ...métodos existentes (004), inalterados...

  /** Lista completa (não paginada) de quem `followerId` segue — só para uso interno do feed (D6). */
  listFolloweeIds(followerId: string): Promise<string[]>;
}
```

---

## Service novo — `src/services/feed/get-feed.service.ts`

```ts
export interface GetFeedInput {
  userId: string;
  cursor: string | null;
  limit: number;
}

export type GetFeed = (input: GetFeedInput) => Promise<FeedCursorPageDTO>;

export interface GetFeedDeps {
  activityRepository: ActivityRepository;
  followRepository: FollowRepository;
  userRepository: UserRepository;
  bookRepository: BookRepository;
  reviewRepository: ReviewRepository;
}
```

Fluxo (RF-006 a RF-013):
1. `followeeIds = followRepository.listFolloweeIds(userId)` (D6).
2. `page = activityRepository.listForActors([userId, ...followeeIds], cursor, limit)` — inclui a
   própria atividade (RF-008).
3. Deduplica `actorId`s e `bookId`s da página; `Promise.all` de `userRepository.findById` e
   `bookRepository.findById` sobre os ids únicos (D5) — monta `Map<id, Record>` de cada um.
4. Para os itens `type === 'review_published'`: `reviewRepository.findBySessionIds` em lote sobre
   os `readingSessionId`s desse tipo na página (D5 da 005, RF-009); monta
   `Map<sessionId, ReviewRecord>`.
5. Monta cada `FeedItemDTO` (ver `data-model.md`) combinando o `ActivityRecord` com os mapas acima;
   `currentPage` só quando `type === 'progress_update'`; `review` só quando
   `type === 'review_published'` (`null` seria um bug de dado — D4 garante que não acontece).

Registro Awilix: `getFeedService`.

---

## Controller/rota novos

```ts
// src/controllers/feed/feed.routes.ts
app.get('/feed', { preHandler: app.authenticate }, getFeedController);

// src/controllers/feed/get-feed.controller.ts
// valida querystring com getFeedSchema (cursor?, limit?) → chama getFeedService → 200 FeedCursorPageDTO
```

`src/schemas/feed/get-feed.schema.ts`:

```ts
export const getFeedSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

---

## Extensões de services existentes (gravação de `Activity`)

Todas as deps abaixo ganham `activityRepository: ActivityRepository`; as que ainda não tinham
`clock` ganham `clock: Clock` também.

### `StartReading` — `src/services/reading-sessions/start-reading.service.ts` (003, alterado)

Depois de `readingSessionRepository.startReading(...)`, só quando `existing === null` (ou seja,
`created === true`, RF-009 da 003): `activityRepository.record({ type: 'started_reading', actorId:
userId, bookId: book.id, readingSessionId: record.id }, clock.now())` (RF-001, D1 do research.md).

### `MarkFinished` — `src/services/reading-sessions/mark-finished.service.ts` (003, alterado)

Ganha `clock: Clock` (não tinha). Depois de `readingSessionRepository.createFinished(...)`, sempre:
`activityRepository.record({ type: 'finished_reading', actorId: userId, bookId: book.id,
readingSessionId: record.id }, clock.now())` (RF-002).

### `UpdateProgress` — `src/services/reading-sessions/update-progress.service.ts` (003, alterado)

Ganha `clock: Clock` (não tinha). Depois de `readingSessionRepository.updateProgress(...)`, sempre:
`activityRepository.record({ type: 'progress_update', actorId: userId, bookId: existing.bookId,
readingSessionId: sessionId, currentPage }, clock.now())` (RF-004).

### `FinishReadingSession` — `src/services/reading-sessions/finish-reading-session.service.ts` (003, alterado)

Só quando `existing.status !== 'finished'` (antes de chamar `repository.finish`, para não duplicar
em chamadas idempotentes — RF-002 + nota de idempotência do `data-model.md`):
`activityRepository.record({ type: 'finished_reading', actorId: userId, bookId: existing.bookId,
readingSessionId: sessionId }, clock.now())`.

### `DeleteReadingSession` — `src/services/reading-sessions/delete-reading-session.service.ts` (003, alterado)

Ganha `activityRepository: ActivityRepository`. Depois de `readingSessionRepository.delete(...)` e
`reviewRepository.deleteBySessionId(...)`: `activityRepository.deleteBySessionId(sessionId)` (D4).

### `CreateReview` — `src/services/reviews/create-review.service.ts` (005, alterado)

Ganha `activityRepository: ActivityRepository` e `clock: Clock` (não tinha). Depois de
`reviewRepository.create(...)`, sempre: `activityRepository.record({ type: 'review_published',
actorId: userId, bookId: session.bookId, readingSessionId: sessionId }, clock.now())` (RF-003).

### `DeleteReview` — `src/services/reviews/delete-review.service.ts` (005, alterado)

Ganha `activityRepository: ActivityRepository`. Depois de `reviewRepository.delete(reviewId)`:
`activityRepository.deleteBySessionIdAndType(existing.sessionId, 'review_published')` (D4).

Registro Awilix: nenhum nome novo nesses 6 — só as deps dos existentes mudam em
`register-services.ts`.
