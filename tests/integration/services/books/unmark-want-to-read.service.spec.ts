import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoBookRepository } from '../../../../src/repositories/books';
import { MongoShelfMembershipRepository } from '../../../../src/repositories/shelf-memberships';
import { makeUnmarkWantToRead } from '../../../../src/services/books';
import { aSearchResult } from '../../../helpers/fake-open-library-client';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const userId = '507f1f77bcf86cd799439011';

describe('unmark-want-to-read service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let bookRepository: MongoBookRepository;
  let shelfMembershipRepository: MongoShelfMembershipRepository;
  let unmarkWantToRead: ReturnType<typeof makeUnmarkWantToRead>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('unmark_want_to_read_service_test');
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
    unmarkWantToRead = makeUnmarkWantToRead({ bookRepository, shelfMembershipRepository });
  });

  it('removes an existing membership', async () => {
    const book = await bookRepository.upsertByOlid(aSearchResult());
    await shelfMembershipRepository.add(userId, book.id);

    await unmarkWantToRead({ userId, olid: 'OL12345W' });

    const count = await db.collection('shelf_memberships').countDocuments({ userId, bookId: book.id });
    expect(count).toBe(0);
  });

  it('resolves without error when the book was never cached (RF-006, D3) — and never touches the network', async () => {
    // makeUnmarkWantToRead is not given an openLibraryClient at all: if it tried to use
    // one, this test would fail to compile/run rather than silently pass.
    await expect(unmarkWantToRead({ userId, olid: 'OL_NEVER_SEEN_W' })).resolves.toBeUndefined();
  });

  it('removing twice is idempotent', async () => {
    const book = await bookRepository.upsertByOlid(aSearchResult());
    await shelfMembershipRepository.add(userId, book.id);

    await unmarkWantToRead({ userId, olid: 'OL12345W' });
    await expect(unmarkWantToRead({ userId, olid: 'OL12345W' })).resolves.toBeUndefined();
  });
});
