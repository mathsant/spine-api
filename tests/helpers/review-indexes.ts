import type { Db } from 'mongodb';

/**
 * Applies the same indexes the reviews-flow migration creates, on a given `Db`.
 * The `migrate-mongo` migration does not run under `mongodb-memory-server`, so
 * integration tests that rely on unique-index behaviour (the `code 11000`
 * translation into `ReviewAlreadyExistsError` — RF-003) call this in `beforeAll`.
 * Keep it in sync with `migrations/`.
 */
export async function ensureReviewIndexes(db: Db): Promise<void> {
  await db
    .collection('reviews')
    .createIndex({ sessionId: 1 }, { unique: true, name: 'reviews_sessionId_unique' });
  await db.collection('reviews').createIndex({ bookId: 1 }, { name: 'reviews_bookId' });
  // Feature 010: batch lookup of a book's reviews restricted to followed users.
  await db.collection('reviews').createIndex({ bookId: 1, userId: 1 }, { name: 'reviews_bookId_userId' });
}
