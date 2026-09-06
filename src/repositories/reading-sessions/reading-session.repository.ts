import type { CursorPage } from '../shelf-memberships';

/** Persisted shape of a reading session, with the Mongo `_id` surfaced as `id`. */
export interface ReadingSessionRecord {
  id: string;
  userId: string;
  bookId: string;
  status: 'reading' | 'finished';
  startedAt: Date | null;
  finishedAt: Date | null;
  currentPage: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EditReadingSessionInput {
  startedAt?: Date;
  finishedAt?: Date;
  currentPage?: number;
}

/** Data-access port for the `reading_sessions` collection. */
export interface ReadingSessionRepository {
  /**
   * Tries to insert a new `reading` session. If one is already open for this
   * user/book (the partial unique index rejects with code 11000), fetches and
   * returns that one instead of propagating the error (RF-009).
   */
  startReading(userId: string, bookId: string, startedAt: Date): Promise<ReadingSessionRecord>;

  /** Always inserts a new `finished` session — never reused, even for a reread (RF-014, RF-016). */
  createFinished(
    userId: string,
    bookId: string,
    input: { startedAt: Date | null; finishedAt: Date },
  ): Promise<ReadingSessionRecord>;

  findById(sessionId: string): Promise<ReadingSessionRecord | null>;

  /** The open (`reading`) session for this user/book, if any — used to report 200 vs 201. */
  findOpenSession(userId: string, bookId: string): Promise<ReadingSessionRecord | null>;

  /** Throws `InvalidReadingSessionStateError` if the session is not `reading` (RF-012). */
  updateProgress(sessionId: string, currentPage: number): Promise<ReadingSessionRecord>;

  /** Sets status to `finished`; idempotent if already `finished` (RF-015 + edge case). */
  finish(sessionId: string, finishedAt: Date): Promise<ReadingSessionRecord>;

  /** Throws `InvalidReadingSessionDatesError` if the result has `finishedAt < startedAt` (RF-017). */
  edit(sessionId: string, patch: EditReadingSessionInput): Promise<ReadingSessionRecord>;

  delete(sessionId: string): Promise<void>;

  /** Cursor page ordered by `createdAt` desc, optionally filtered by `bookId` (RF-019). */
  listByUser(
    userId: string,
    filter: { bookId?: string },
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<ReadingSessionRecord>>;

  /** Distinct `userId`s with at least one `finished` session of this book. */
  countDistinctFinishedReaders(bookId: string): Promise<number>;

  /**
   * At most one record per `userId` in `userIds`: that user's most recent `finished`
   * session of `bookId` (by `finishedAt`, then `createdAt`, then `_id`). Empty
   * `userIds` returns `[]` without touching the database. Used by
   * `GET /books/:olid/reviews` (feature 010).
   */
  findLatestFinishedPerUserForBook(
    bookId: string,
    userIds: string[],
  ): Promise<ReadingSessionRecord[]>;
}
