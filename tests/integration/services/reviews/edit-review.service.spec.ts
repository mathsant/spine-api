import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ReviewNotFoundError } from '../../../../src/errors';
import { MongoReviewRepository } from '../../../../src/repositories/reviews';
import { makeEditReview } from '../../../../src/services/reviews';
import { ensureReviewIndexes } from '../../../helpers/review-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const userId = '507f1f77bcf86cd799439011';
const otherUserId = '507f1f77bcf86cd799439099';
const sessionId = '507f1f77bcf86cd799439022';
const bookId = '507f1f77bcf86cd799439033';

describe('edit-review service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let reviewRepository: MongoReviewRepository;
  let editReview: ReturnType<typeof makeEditReview>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('edit_review_service_test');
    await ensureReviewIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('reviews').deleteMany({});
    reviewRepository = new MongoReviewRepository(db);
    editReview = makeEditReview({ reviewRepository });
  });

  it('updates only the patched fields, owned by the user', async () => {
    const review = await reviewRepository.create(userId, sessionId, bookId, {
      rating: 4,
      text: 'Original',
      containsSpoiler: false,
    });

    const updated = await editReview({ userId, reviewId: review.id, patch: { rating: 5 } });

    expect(updated.rating).toBe(5);
    expect(updated.text).toBe('Original');
    expect(updated.containsSpoiler).toBe(false);
  });

  it('allows clearing text via null (cenário 7)', async () => {
    const review = await reviewRepository.create(userId, sessionId, bookId, {
      rating: 4,
      text: 'Original',
    });

    const updated = await editReview({ userId, reviewId: review.id, patch: { text: null } });
    expect(updated.text).toBeNull();
  });

  it('treats a nonexistent review as not found', async () => {
    await expect(
      editReview({ userId, reviewId: '507f1f77bcf86cd799439999', patch: { rating: 1 } }),
    ).rejects.toBeInstanceOf(ReviewNotFoundError);
  });

  it("treats another user's review as not found (D7/D9)", async () => {
    const review = await reviewRepository.create(otherUserId, sessionId, bookId, { rating: 4 });

    await expect(
      editReview({ userId, reviewId: review.id, patch: { rating: 1 } }),
    ).rejects.toBeInstanceOf(ReviewNotFoundError);
  });
});
