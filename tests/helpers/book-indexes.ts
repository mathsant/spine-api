import type { Db } from 'mongodb';

/**
 * Applies the same indexes the books-flow migrations create, on a given `Db`.
 * The `migrate-mongo` migrations do not run under `mongodb-memory-server`, so
 * integration tests that rely on unique-index behaviour (books.olid/isbn13,
 * shelf_memberships.{userId,bookId}, and the partial unique index that caps
 * reading_sessions at one open session per book/user — RF-009) call this in
 * `beforeAll`. Keep it in sync with `migrations/`.
 */
export async function ensureBookIndexes(db: Db): Promise<void> {
  await db.collection('books').createIndex({ olid: 1 }, { unique: true, name: 'books_olid_unique' });
  await db
    .collection('books')
    .createIndex({ isbn13: 1 }, { unique: true, sparse: true, name: 'books_isbn13_unique_sparse' });
  await db
    .collection('shelf_memberships')
    .createIndex(
      { userId: 1, bookId: 1 },
      { unique: true, name: 'shelf_memberships_userId_bookId_unique' },
    );
  await db.collection('reading_sessions').createIndex(
    { userId: 1, bookId: 1 },
    {
      unique: true,
      partialFilterExpression: { status: 'reading' },
      name: 'reading_sessions_open_unique',
    },
  );
  await db
    .collection('reading_sessions')
    .createIndex({ userId: 1, createdAt: -1 }, { name: 'reading_sessions_userId_createdAt' });
  await db
    .collection('reading_sessions')
    .createIndex({ userId: 1, bookId: 1 }, { name: 'reading_sessions_userId_bookId' });
}
