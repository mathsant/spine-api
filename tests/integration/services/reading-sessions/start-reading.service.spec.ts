import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoBookRepository } from '../../../../src/repositories/books';
import { MongoReadingSessionRepository } from '../../../../src/repositories/reading-sessions';
import { MongoShelfMembershipRepository } from '../../../../src/repositories/shelf-memberships';
import { makeStartReading } from '../../../../src/services/reading-sessions';
import { aSearchResult, FakeOpenLibraryClient } from '../../../helpers/fake-open-library-client';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const userId = '507f1f77bcf86cd799439011';

describe('start-reading service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let bookRepository: MongoBookRepository;
  let readingSessionRepository: MongoReadingSessionRepository;
  let shelfMembershipRepository: MongoShelfMembershipRepository;
  let openLibraryClient: FakeOpenLibraryClient;
  let startReading: ReturnType<typeof makeStartReading>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('start_reading_service_test');
    await ensureBookIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      ['books', 'shelf_memberships', 'reading_sessions'].map((c) => db.collection(c).deleteMany({})),
    );
    bookRepository = new MongoBookRepository(db);
    readingSessionRepository = new MongoReadingSessionRepository(db);
    shelfMembershipRepository = new MongoShelfMembershipRepository(db);
    openLibraryClient = new FakeOpenLibraryClient();
    startReading = makeStartReading({
      bookRepository,
      openLibraryClient,
      readingSessionRepository,
      shelfMembershipRepository,
      clock: { now: () => new Date('2025-06-01T00:00:00.000Z') },
    });
  });

  it('creates a new reading session when none is open (created: true)', async () => {
    await bookRepository.upsertByOlid(aSearchResult());

    const result = await startReading({ userId, olid: 'OL12345W' });

    expect(result.created).toBe(true);
    expect(result.session).toMatchObject({ status: 'reading', startedAt: '2025-06-01T00:00:00.000Z' });
  });

  it('reuses the open session on a second call (created: false, RF-009)', async () => {
    await bookRepository.upsertByOlid(aSearchResult());

    const first = await startReading({ userId, olid: 'OL12345W' });
    const second = await startReading({ userId, olid: 'OL12345W' });

    expect(second.created).toBe(false);
    expect(second.session.id).toBe(first.session.id);
  });

  it('removes want_to_read when it was present (RF-010)', async () => {
    const book = await bookRepository.upsertByOlid(aSearchResult());
    await shelfMembershipRepository.add(userId, book.id);

    await startReading({ userId, olid: 'OL12345W' });

    const count = await db
      .collection('shelf_memberships')
      .countDocuments({ userId, bookId: book.id });
    expect(count).toBe(0);
  });

  it('caches the book first when not cached yet', async () => {
    openLibraryClient.seed(aSearchResult());

    const result = await startReading({ userId, olid: 'OL12345W' });

    expect(result.created).toBe(true);
    expect(await bookRepository.findByOlid('OL12345W')).not.toBeNull();
  });
});
