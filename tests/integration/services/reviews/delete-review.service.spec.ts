import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ReviewNotFoundError } from '../../../../src/errors';
import { MongoActivityRepository } from '../../../../src/repositories/activities';
import { MongoReviewRepository } from '../../../../src/repositories/reviews';
import { makeDeleteReview } from '../../../../src/services/reviews';
import { ensureReviewIndexes } from '../../../helpers/review-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const userId = '507f1f77bcf86cd799439011';
const otherUserId = '507f1f77bcf86cd799439099';
const sessionId = '507f1f77bcf86cd799439022';
const bookId = '507f1f77bcf86cd799439033';

describe('delete-review service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let reviewRepository: MongoReviewRepository;
  let activityRepository: MongoActivityRepository;
  let deleteReview: ReturnType<typeof makeDeleteReview>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('delete_review_service_test');
    await ensureReviewIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(['reviews', 'activities'].map((c) => db.collection(c).deleteMany({})));
    reviewRepository = new MongoReviewRepository(db);
    activityRepository = new MongoActivityRepository(db);
    deleteReview = makeDeleteReview({ reviewRepository, activityRepository });
  });

  it('deletes a review owned by the user', async () => {
    const review = await reviewRepository.create(userId, sessionId, bookId, { rating: 4 });

    await deleteReview({ userId, reviewId: review.id });
    expect(await reviewRepository.findById(review.id)).toBeNull();
  });

  it('treats a nonexistent review as not found', async () => {
    await expect(
      deleteReview({ userId, reviewId: '507f1f77bcf86cd799439999' }),
    ).rejects.toBeInstanceOf(ReviewNotFoundError);
  });

  it("treats another user's review as not found and does not delete it (D7/D9)", async () => {
    const review = await reviewRepository.create(otherUserId, sessionId, bookId, { rating: 4 });

    await expect(deleteReview({ userId, reviewId: review.id })).rejects.toBeInstanceOf(
      ReviewNotFoundError,
    );
    expect(await reviewRepository.findById(review.id)).not.toBeNull();
  });

  it('removes only the review_published activity of the session, keeping other event types (006, D4)', async () => {
    const review = await reviewRepository.create(userId, sessionId, bookId, { rating: 4 });
    await activityRepository.record(
      { type: 'started_reading', actorId: userId, bookId, readingSessionId: sessionId },
      new Date(),
    );
    await activityRepository.record(
      { type: 'review_published', actorId: userId, bookId, readingSessionId: sessionId },
      new Date(),
    );

    await deleteReview({ userId, reviewId: review.id });

    const page = await activityRepository.listForActors([userId], null, 20);
    expect(page.items.map((item) => item.type)).toEqual(['started_reading']);
  });
});
