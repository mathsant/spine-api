# Contratos internos (ports) — Reviews

Interfaces TypeScript que as camadas expõem umas às outras. Nomes em inglês; caminhos seguem
`.specify/memory/architecture.md`. Fluxo unidirecional: controller → service → repository; só
`repositories/**`, `db/**` tocam o driver `mongodb`.

---

## `ReviewRepository` — `src/repositories/reviews/review.repository.ts` (NOVO)

Port de acesso a `reviews`. Registro Awilix: `reviewRepository`.

```ts
export interface ReviewRecord {
  id: string;
  userId: string;
  sessionId: string;
  bookId: string;
  rating: number;
  text: string | null;
  containsSpoiler: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReviewInput {
  rating: number;
  text?: string | null;
  containsSpoiler?: boolean;
}

export interface EditReviewInput {
  rating?: number;
  text?: string | null;
  containsSpoiler?: boolean;
}

export interface ReviewAggregates {
  averageRating: number | null; // já arredondado (D4 do research.md)
  reviewCount: number;
}

export interface ReviewRepository {
  /** Insere; violação do índice único `sessionId` (código 11000) vira `ReviewAlreadyExistsError` — nunca absorve a corrida (D2, RF-003). */
  create(
    userId: string,
    sessionId: string,
    bookId: string,
    input: CreateReviewInput,
  ): Promise<ReviewRecord>;

  findById(reviewId: string): Promise<ReviewRecord | null>;

  findBySessionId(sessionId: string): Promise<ReviewRecord | null>;

  /** Busca em lote por `$in`, usada por `list-reading-sessions` para embutir sem N+1 (D5). */
  findBySessionIds(sessionIds: string[]): Promise<ReviewRecord[]>;

  /** `$set` só das chaves presentes em `patch` (RF-005). */
  edit(reviewId: string, patch: EditReviewInput): Promise<ReviewRecord>;

  delete(reviewId: string): Promise<void>;

  /** Idempotente — não erro se a session não tiver review (cascade de RF-007). */
  deleteBySessionId(sessionId: string): Promise<void>;

  /** `{ averageRating: null, reviewCount: 0 }` se não houver nenhuma review do livro (RF-009). */
  getAggregatesByBook(bookId: string): Promise<ReviewAggregates>;
}
```

---

## Services novos — `src/services/reviews/`

```ts
// create-review.service.ts
export interface CreateReviewInput {
  userId: string;
  sessionId: string;
  rating: number;
  text?: string | null;
  containsSpoiler?: boolean;
}
export type CreateReview = (input: CreateReviewInput) => Promise<ReviewDTO>;
export interface CreateReviewDeps {
  reviewRepository: ReviewRepository;
  readingSessionRepository: ReadingSessionRepository; // para achar/validar a session (posse + status)
}
// Fluxo: findById(sessionId) → 404 se ausente/não é do userId (RF-008) →
// 409 ReadingSessionNotFinishedError se status !== 'finished' (RF-002) →
// 409 ReviewAlreadyExistsError se já existe review pra essa session (RF-003, findBySessionId) →
// reviewRepository.create(userId, sessionId, session.bookId, input).

// edit-review.service.ts
export interface EditReviewInput {
  userId: string;
  reviewId: string;
  patch: EditReviewInput; // do repository — rating?/text?/containsSpoiler?
}
export type EditReview = (input: EditReviewInput) => Promise<ReviewDTO>;
export interface EditReviewDeps { reviewRepository: ReviewRepository }
// Fluxo: findById(reviewId) → 404 ReviewNotFoundError se ausente/não é do userId (RF-008) →
// reviewRepository.edit(reviewId, patch).

// delete-review.service.ts
export interface DeleteReviewInput { userId: string; reviewId: string }
export type DeleteReview = (input: DeleteReviewInput) => Promise<void>;
export interface DeleteReviewDeps { reviewRepository: ReviewRepository }
// Fluxo: findById(reviewId) → 404 ReviewNotFoundError se ausente/não é do userId (RF-008) →
// reviewRepository.delete(reviewId).
```

Registro Awilix: `createReviewService`, `editReviewService`, `deleteReviewService`.

`ReviewDTO` (retornado pelos 3): ver `data-model.md` — `{ id, sessionId, rating, text,
containsSpoiler, createdAt, updatedAt }`, produzido por `src/services/reviews/to-dto.ts`.

---

## Extensões de services existentes

### `GetBook` — `src/services/books/get-book.service.ts` (003, alterado)

`GetBookDeps` ganha `reviewRepository: ReviewRepository`. `toDTO` deixa de receber
`averageRating`/`reviewCount` fixos (`null`/`0`) e passa a receber o resultado de
`reviewRepository.getAggregatesByBook(book.id)`, chamado ao lado de
`readingSessionRepository.countDistinctFinishedReaders(book.id)` (RF-009).

### `DeleteReadingSession` — `src/services/reading-sessions/delete-reading-session.service.ts` (003, alterado)

`DeleteReadingSessionDeps` ganha `reviewRepository: ReviewRepository`. Depois de confirmar
posse e antes/depois de `readingSessionRepository.delete(sessionId)`, chama
`reviewRepository.deleteBySessionId(sessionId)` (RF-007, cascade).

### `ListReadingSessions` — `src/services/reading-sessions/list-reading-sessions.service.ts` (003, alterado)

`ListReadingSessionsDeps` ganha `reviewRepository: ReviewRepository`. Depois de
`readingSessionRepository.listByUser(...)`, busca
`reviewRepository.findBySessionIds(page.items.map(s => s.id))`, monta um `Map<sessionId,
ReviewRecord>` e passa a review correspondente (ou `undefined`) para
`toReadingSessionDTO(record, reviewsBySessionId.get(record.id) ?? null)` (RF-010, D5).

### `toReadingSessionDTO` — `src/services/reading-sessions/to-dto.ts` (003, alterado)

Assinatura passa a `toReadingSessionDTO(record: ReadingSessionRecord, review: ReviewRecord |
null = null): ReadingSessionDTO`, incluindo `review: review ? toReviewDTO(review) : null` no
retorno. Todo call site que já existia (`start-reading`, `mark-finished`, `update-progress`,
`finish-reading-session`, `edit-reading-session`) continua chamando com 1 argumento e recebe
`review: null` automaticamente — nenhuma alteração necessária nesses arquivos.

---

## Erros novos — `src/errors/`

```ts
// review-not-found-error.ts
export class ReviewNotFoundError extends AppError {
  constructor(message = 'Review not found') {
    super('REVIEW_NOT_FOUND', 404, message);
  }
}

// reading-session-not-finished-error.ts
export class ReadingSessionNotFinishedError extends AppError {
  constructor(message = 'Reading session is not finished') {
    super('READING_SESSION_NOT_FINISHED', 409, message);
  }
}

// review-already-exists-error.ts
export class ReviewAlreadyExistsError extends AppError {
  constructor(message = 'Review already exists for this reading session') {
    super('REVIEW_ALREADY_EXISTS', 409, message);
  }
}
```

Todas re-exportadas em `src/errors/index.ts`, mesmo padrão das existentes.
