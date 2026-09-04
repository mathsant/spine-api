/** Persisted shape of a review, with the Mongo `_id` surfaced as `id`. */
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
  averageRating: number | null;
  reviewCount: number;
}

/** Data-access port for the `reviews` collection. */
export interface ReviewRepository {
  /**
   * Inserts a review. A duplicate `sessionId` (the unique index, code 11000) is translated
   * into `ReviewAlreadyExistsError` — never absorbed/overwritten (RF-003, D2).
   */
  create(
    userId: string,
    sessionId: string,
    bookId: string,
    input: CreateReviewInput,
  ): Promise<ReviewRecord>;

  findById(reviewId: string): Promise<ReviewRecord | null>;

  findBySessionId(sessionId: string): Promise<ReviewRecord | null>;

  /** Batch lookup by `$in`, used by `list-reading-sessions` to embed reviews without N+1 (D5). */
  findBySessionIds(sessionIds: string[]): Promise<ReviewRecord[]>;

  /** `$set` of only the keys present in `patch` (RF-005). */
  edit(reviewId: string, patch: EditReviewInput): Promise<ReviewRecord>;

  delete(reviewId: string): Promise<void>;

  /** Idempotent — no error if the session has no review (cascade of RF-007). */
  deleteBySessionId(sessionId: string): Promise<void>;

  /** `{ averageRating: null, reviewCount: 0 }` when the book has no review yet (RF-009). */
  getAggregatesByBook(bookId: string): Promise<ReviewAggregates>;
}
