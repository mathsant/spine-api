import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoBookRepository } from '../../../../src/repositories/books';
import { MongoShelfMembershipRepository } from '../../../../src/repositories/shelf-memberships';
import { makeMarkWantToRead } from '../../../../src/services/books';
import { aSearchResult, FakeOpenLibraryClient } from '../../../helpers/fake-open-library-client';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const userId = '507f1f77bcf86cd799439011';

describe('mark-want-to-read service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let bookRepository: MongoBookRepository;
  let shelfMembershipRepository: MongoShelfMembershipRepository;
  let openLibraryClient: FakeOpenLibraryClient;
  let markWantToRead: ReturnType<typeof makeMarkWantToRead>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('mark_want_to_read_service_test');
    await ensureBookIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('books').deleteMany({});
    await db.collection('shelf_memberships').deleteMany({});
    bookRepository = new MongoBookRepository(db);
    shelfMembershipRepository = new MongoShelfMembershipRepository(db);
    openLibraryClient = new FakeOpenLibraryClient();
    markWantToRead = makeMarkWantToRead({ bookRepository, openLibraryClient, shelfMembershipRepository });
  });

  it('creates the membership for an already-cached book', async () => {
    const book = await bookRepository.upsertByOlid(aSearchResult());

    await markWantToRead({ userId, olid: 'OL12345W' });

    const count = await db
      .collection('shelf_memberships')
      .countDocuments({ userId, bookId: book.id });
    expect(count).toBe(1);
  });

  it('caches the book first when not cached yet, then creates the membership', async () => {
    openLibraryClient.seed(aSearchResult());

    await markWantToRead({ userId, olid: 'OL12345W' });

    const book = await bookRepository.findByOlid('OL12345W');
    expect(book).not.toBeNull();
    const count = await db
      .collection('shelf_memberships')
      .countDocuments({ userId, bookId: book?.id });
    expect(count).toBe(1);
  });

  it('marking twice is idempotent (D6)', async () => {
    await bookRepository.upsertByOlid(aSearchResult());

    await markWantToRead({ userId, olid: 'OL12345W' });
    await markWantToRead({ userId, olid: 'OL12345W' });

    const count = await db.collection('shelf_memberships').countDocuments({ userId });
    expect(count).toBe(1);
  });
});
