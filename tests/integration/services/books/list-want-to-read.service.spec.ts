import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoBookRepository } from '../../../../src/repositories/books';
import { MongoShelfMembershipRepository } from '../../../../src/repositories/shelf-memberships';
import { makeListWantToRead } from '../../../../src/services/books';
import { aSearchResult } from '../../../helpers/fake-open-library-client';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const userId = '507f1f77bcf86cd799439011';

describe('list-want-to-read service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let bookRepository: MongoBookRepository;
  let shelfMembershipRepository: MongoShelfMembershipRepository;
  let listWantToRead: ReturnType<typeof makeListWantToRead>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('list_want_to_read_service_test');
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
    listWantToRead = makeListWantToRead({ shelfMembershipRepository, bookRepository });
  });

  it('returns an empty page when there are no memberships', async () => {
    const page = await listWantToRead({ userId, cursor: null, limit: 20 });
    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it('resolves the full book data for each membership, most recent first', async () => {
    const bookA = await bookRepository.upsertByOlid(
      aSearchResult({ olid: 'OL_A_W', isbn13: '1111111111111', title: 'A' }),
    );
    const bookB = await bookRepository.upsertByOlid(
      aSearchResult({ olid: 'OL_B_W', isbn13: '2222222222222', title: 'B' }),
    );
    await shelfMembershipRepository.add(userId, bookA.id);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await shelfMembershipRepository.add(userId, bookB.id);

    const page = await listWantToRead({ userId, cursor: null, limit: 20 });

    expect(page.items.map((item) => item.olid)).toEqual(['OL_B_W', 'OL_A_W']);
    expect(page.items.map((item) => item.pageCount)).toEqual([412, 412]);
    expect(page.nextCursor).toBeNull();
  });

  it('carries pageCount as null for a book cached before the field existed', async () => {
    await db.collection('books').insertOne({
      olid: 'OL_LEGACY_W',
      title: 'Legado',
      authors: [],
      coverUrl: null,
      firstPublishYear: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const legacy = await bookRepository.findByOlid('OL_LEGACY_W');
    await shelfMembershipRepository.add(userId, legacy!.id);

    const page = await listWantToRead({ userId, cursor: null, limit: 20 });
    expect(page.items[0].pageCount).toBeNull();
  });

  it('paginates with a cursor when there are more items than the limit', async () => {
    const bookA = await bookRepository.upsertByOlid(
      aSearchResult({ olid: 'OL_A_W', isbn13: '1111111111111' }),
    );
    const bookB = await bookRepository.upsertByOlid(
      aSearchResult({ olid: 'OL_B_W', isbn13: '2222222222222' }),
    );
    await shelfMembershipRepository.add(userId, bookA.id);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await shelfMembershipRepository.add(userId, bookB.id);

    const firstPage = await listWantToRead({ userId, cursor: null, limit: 1 });
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await listWantToRead({ userId, cursor: firstPage.nextCursor, limit: 1 });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
  });
});
