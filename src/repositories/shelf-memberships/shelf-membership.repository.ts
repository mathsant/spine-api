/** Persisted shape of a want-to-read mark, with the Mongo `_id` surfaced as `id`. */
export interface ShelfMembershipRecord {
  id: string;
  userId: string;
  bookId: string;
  createdAt: Date;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/** Data-access port for the `shelf_memberships` collection. */
export interface ShelfMembershipRepository {
  /** Upsert — marking the same pair twice is a no-op (RF-005, D6). */
  add(userId: string, bookId: string): Promise<void>;
  /** Removing a pair that doesn't exist is not an error (RF-006). */
  remove(userId: string, bookId: string): Promise<void>;
  /** Cursor page ordered by `createdAt` desc. */
  list(userId: string, cursor: string | null, limit: number): Promise<CursorPage<ShelfMembershipRecord>>;
  /** Distinct `bookId`s this user marked as want-to-read. Feature 010 — used to
   * exclude already-known books from `GET /books/popular-among-following`. */
  listBookIdsForUser(userId: string): Promise<string[]>;
  /** Count of this user's want-to-read marks — `wantToRead` in `GET /me/stats` (011). */
  countForUser(userId: string): Promise<number>;
}
