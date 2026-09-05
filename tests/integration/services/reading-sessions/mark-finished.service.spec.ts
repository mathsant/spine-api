import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoActivityRepository } from '../../../../src/repositories/activities';
import { MongoBookRepository } from '../../../../src/repositories/books';
import { MongoReadingSessionRepository } from '../../../../src/repositories/reading-sessions';
import { MongoShelfMembershipRepository } from '../../../../src/repositories/shelf-memberships';
import { makeMarkFinished } from '../../../../src/services/reading-sessions';
import { aSearchResult, FakeOpenLibraryClient } from '../../../helpers/fake-open-library-client';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const userId = '507f1f77bcf86cd799439011';

describe('mark-finished service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let bookRepository: MongoBookRepository;
  let readingSessionRepository: MongoReadingSessionRepository;
  let shelfMembershipRepository: MongoShelfMembershipRepository;
  let activityRepository: MongoActivityRepository;
  let openLibraryClient: FakeOpenLibraryClient;
  let markFinished: ReturnType<typeof makeMarkFinished>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('mark_finished_service_test');
    await ensureBookIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      ['books', 'shelf_memberships', 'reading_sessions', 'activities'].map((c) =>
        db.collection(c).deleteMany({}),
      ),
    );
    bookRepository = new MongoBookRepository(db);
    readingSessionRepository = new MongoReadingSessionRepository(db);
    shelfMembershipRepository = new MongoShelfMembershipRepository(db);
    activityRepository = new MongoActivityRepository(db);
    openLibraryClient = new FakeOpenLibraryClient();
    markFinished = makeMarkFinished({
      bookRepository,
      openLibraryClient,
      readingSessionRepository,
      shelfMembershipRepository,
      activityRepository,
      clock: { now: () => new Date('2025-06-01T00:00:00.000Z') },
    });
  });

  it('creates a finished session directly, startedAt optional (RF-014)', async () => {
    await bookRepository.upsertByOlid(aSearchResult());
    const finishedAt = '2025-01-10T00:00:00.000Z';

    const session = await markFinished({ userId, olid: 'OL12345W', finishedAt: new Date(finishedAt) });

    expect(session).toMatchObject({ status: 'finished', startedAt: null, finishedAt });
  });

  it('creates a new, independent session on a reread (RF-016)', async () => {
    await bookRepository.upsertByOlid(aSearchResult());

    const first = await markFinished({
      userId,
      olid: 'OL12345W',
      finishedAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    const second = await markFinished({
      userId,
      olid: 'OL12345W',
      finishedAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    expect(second.id).not.toBe(first.id);
  });

  it('removes want_to_read when it was present (RF-010)', async () => {
    const book = await bookRepository.upsertByOlid(aSearchResult());
    await shelfMembershipRepository.add(userId, book.id);

    await markFinished({ userId, olid: 'OL12345W', finishedAt: new Date() });

    const count = await db
      .collection('shelf_memberships')
      .countDocuments({ userId, bookId: book.id });
    expect(count).toBe(0);
  });

  it('caches the book first when not cached yet', async () => {
    openLibraryClient.seed(aSearchResult());

    await markFinished({ userId, olid: 'OL12345W', finishedAt: new Date() });

    expect(await bookRepository.findByOlid('OL12345W')).not.toBeNull();
  });

  it('records a finished_reading activity (RF-002)', async () => {
    await bookRepository.upsertByOlid(aSearchResult());

    await markFinished({ userId, olid: 'OL12345W', finishedAt: new Date('2025-01-10T00:00:00.000Z') });

    const page = await activityRepository.listForActors([userId], null, 20);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].type).toBe('finished_reading');
  });
});
