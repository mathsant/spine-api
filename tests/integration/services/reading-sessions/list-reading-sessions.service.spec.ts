import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoReadingSessionRepository } from '../../../../src/repositories/reading-sessions';
import { MongoReviewRepository } from '../../../../src/repositories/reviews';
import { makeListReadingSessions } from '../../../../src/services/reading-sessions';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { ensureReviewIndexes } from '../../../helpers/review-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const userId = '507f1f77bcf86cd799439011';
const bookId = '507f1f77bcf86cd799439022';
const otherBookId = '507f1f77bcf86cd799439033';

describe('list-reading-sessions service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let readingSessionRepository: MongoReadingSessionRepository;
  let reviewRepository: MongoReviewRepository;
  let listReadingSessions: ReturnType<typeof makeListReadingSessions>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('list_reading_sessions_service_test');
    await ensureBookIndexes(db);
    await ensureReviewIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('reading_sessions').deleteMany({});
    await db.collection('reviews').deleteMany({});
    readingSessionRepository = new MongoReadingSessionRepository(db);
    reviewRepository = new MongoReviewRepository(db);
    listReadingSessions = makeListReadingSessions({ readingSessionRepository, reviewRepository });
  });

  it('paginates the history across all statuses and books', async () => {
    await readingSessionRepository.createFinished(userId, bookId, { startedAt: null, finishedAt: new Date('2024-01-01T00:00:00.000Z') });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await readingSessionRepository.startReading(userId, otherBookId, new Date('2024-02-01T00:00:00.000Z'));

    const page = await listReadingSessions({ userId, cursor: null, limit: 20 });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  it('includes rereads of the same book (multiple finished sessions)', async () => {
    await readingSessionRepository.createFinished(userId, bookId, { startedAt: null, finishedAt: new Date('2024-01-01T00:00:00.000Z') });
    await readingSessionRepository.createFinished(userId, bookId, { startedAt: null, finishedAt: new Date('2025-01-01T00:00:00.000Z') });

    const page = await listReadingSessions({ userId, bookId, cursor: null, limit: 20 });
    expect(page.items).toHaveLength(2);
  });

  it('filters by bookId when provided', async () => {
    await readingSessionRepository.createFinished(userId, bookId, { startedAt: null, finishedAt: new Date() });
    await readingSessionRepository.createFinished(userId, otherBookId, { startedAt: null, finishedAt: new Date() });

    const page = await listReadingSessions({ userId, bookId, cursor: null, limit: 20 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].bookId).toBe(bookId);
  });

  it('embeds the review of a session that has one, and null otherwise (RF-010)', async () => {
    const reviewed = await readingSessionRepository.createFinished(userId, bookId, {
      startedAt: null,
      finishedAt: new Date(),
    });
    const unreviewed = await readingSessionRepository.createFinished(userId, otherBookId, {
      startedAt: null,
      finishedAt: new Date(),
    });
    await reviewRepository.create(userId, reviewed.id, bookId, { rating: 4 });

    const page = await listReadingSessions({ userId, cursor: null, limit: 20 });

    const reviewedItem = page.items.find((item) => item.id === reviewed.id);
    const unreviewedItem = page.items.find((item) => item.id === unreviewed.id);
    expect(reviewedItem?.review).toMatchObject({ rating: 4 });
    expect(unreviewedItem?.review).toBeNull();
  });
});
