import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ReadingSessionNotFinishedError, ReadingSessionNotFoundError, ReviewAlreadyExistsError } from '../../../../src/errors';
import { MongoActivityRepository } from '../../../../src/repositories/activities';
import { MongoReadingSessionRepository } from '../../../../src/repositories/reading-sessions';
import { MongoReviewRepository } from '../../../../src/repositories/reviews';
import { makeCreateReview } from '../../../../src/services/reviews';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { ensureReviewIndexes } from '../../../helpers/review-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const userId = '507f1f77bcf86cd799439011';
const otherUserId = '507f1f77bcf86cd799439099';
const bookId = '507f1f77bcf86cd799439022';

describe('create-review service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let readingSessionRepository: MongoReadingSessionRepository;
  let reviewRepository: MongoReviewRepository;
  let activityRepository: MongoActivityRepository;
  let createReview: ReturnType<typeof makeCreateReview>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('create_review_service_test');
    await ensureBookIndexes(db);
    await ensureReviewIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      ['reading_sessions', 'reviews', 'activities'].map((c) => db.collection(c).deleteMany({})),
    );
    readingSessionRepository = new MongoReadingSessionRepository(db);
    reviewRepository = new MongoReviewRepository(db);
    activityRepository = new MongoActivityRepository(db);
    createReview = makeCreateReview({
      reviewRepository,
      readingSessionRepository,
      activityRepository,
      clock: { now: () => new Date('2025-06-01T00:00:00.000Z') },
    });
  });

  it('creates a review for a finished session owned by the user', async () => {
    const session = await readingSessionRepository.createFinished(userId, bookId, {
      startedAt: null,
      finishedAt: new Date(),
    });

    const review = await createReview({
      userId,
      sessionId: session.id,
      rating: 4,
      text: 'Great read',
      containsSpoiler: false,
    });

    expect(review.sessionId).toBe(session.id);
    expect(review.rating).toBe(4);
    expect(review.text).toBe('Great read');
  });

  it('rejects a session that is still reading (RF-002)', async () => {
    const session = await readingSessionRepository.startReading(userId, bookId, new Date());

    await expect(
      createReview({ userId, sessionId: session.id, rating: 3 }),
    ).rejects.toBeInstanceOf(ReadingSessionNotFinishedError);
  });

  it('rejects a second review on the same session (RF-003)', async () => {
    const session = await readingSessionRepository.createFinished(userId, bookId, {
      startedAt: null,
      finishedAt: new Date(),
    });
    await createReview({ userId, sessionId: session.id, rating: 4 });

    await expect(
      createReview({ userId, sessionId: session.id, rating: 5 }),
    ).rejects.toBeInstanceOf(ReviewAlreadyExistsError);
  });

  it('treats a nonexistent session as not found', async () => {
    await expect(
      createReview({ userId, sessionId: '507f1f77bcf86cd799439999', rating: 4 }),
    ).rejects.toBeInstanceOf(ReadingSessionNotFoundError);
  });

  it("treats another user's session as not found (D7/D9)", async () => {
    const session = await readingSessionRepository.createFinished(otherUserId, bookId, {
      startedAt: null,
      finishedAt: new Date(),
    });

    await expect(
      createReview({ userId, sessionId: session.id, rating: 4 }),
    ).rejects.toBeInstanceOf(ReadingSessionNotFoundError);
  });

  it('records a review_published activity (RF-003)', async () => {
    const session = await readingSessionRepository.createFinished(userId, bookId, {
      startedAt: null,
      finishedAt: new Date(),
    });

    await createReview({ userId, sessionId: session.id, rating: 4 });

    const page = await activityRepository.listForActors([userId], null, 20);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].type).toBe('review_published');
    expect(page.items[0].readingSessionId).toBe(session.id);
  });
});
