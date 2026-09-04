import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ReviewAlreadyExistsError } from '../../../../src/errors';
import { MongoReviewRepository } from '../../../../src/repositories/reviews';
import { ensureReviewIndexes } from '../../../helpers/review-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const userId = '507f1f77bcf86cd799439011';
const sessionId = '507f1f77bcf86cd799439022';
const otherSessionId = '507f1f77bcf86cd799439033';
const bookId = '507f1f77bcf86cd799439044';
const otherBookId = '507f1f77bcf86cd799439055';

describe('MongoReviewRepository (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let repository: MongoReviewRepository;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('mongo_review_repository_test');
    await ensureReviewIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('reviews').deleteMany({});
    repository = new MongoReviewRepository(db);
  });

  it('creates a review', async () => {
    const review = await repository.create(userId, sessionId, bookId, {
      rating: 4,
      text: 'Great book',
      containsSpoiler: true,
    });

    expect(review.userId).toBe(userId);
    expect(review.sessionId).toBe(sessionId);
    expect(review.bookId).toBe(bookId);
    expect(review.rating).toBe(4);
    expect(review.text).toBe('Great book');
    expect(review.containsSpoiler).toBe(true);
  });

  it('defaults text to null and containsSpoiler to false when omitted', async () => {
    const review = await repository.create(userId, sessionId, bookId, { rating: 3 });

    expect(review.text).toBeNull();
    expect(review.containsSpoiler).toBe(false);
  });

  it('rejects a second review for the same session (RF-003, D2)', async () => {
    await repository.create(userId, sessionId, bookId, { rating: 4 });

    await expect(
      repository.create(userId, sessionId, bookId, { rating: 5 }),
    ).rejects.toBeInstanceOf(ReviewAlreadyExistsError);
  });

  it('finds by id and returns null when absent', async () => {
    const created = await repository.create(userId, sessionId, bookId, { rating: 4 });

    expect((await repository.findById(created.id))?.id).toBe(created.id);
    expect(await repository.findById('507f1f77bcf86cd799439999')).toBeNull();
  });

  it('finds by sessionId and returns null when absent', async () => {
    await repository.create(userId, sessionId, bookId, { rating: 4 });

    expect((await repository.findBySessionId(sessionId))?.sessionId).toBe(sessionId);
    expect(await repository.findBySessionId(otherSessionId)).toBeNull();
  });

  it('finds several by sessionIds in one query', async () => {
    await repository.create(userId, sessionId, bookId, { rating: 4 });
    await repository.create(userId, otherSessionId, bookId, { rating: 2 });

    const found = await repository.findBySessionIds([sessionId, otherSessionId, 'nonexistent']);
    expect(found).toHaveLength(2);
    expect(found.map((r) => r.sessionId).sort()).toEqual([otherSessionId, sessionId].sort());
  });

  it('edits only the patched fields', async () => {
    const created = await repository.create(userId, sessionId, bookId, {
      rating: 4,
      text: 'Original',
      containsSpoiler: false,
    });

    const edited = await repository.edit(created.id, { rating: 5 });

    expect(edited.rating).toBe(5);
    expect(edited.text).toBe('Original');
    expect(edited.containsSpoiler).toBe(false);
  });

  it('allows setting text to null via edit', async () => {
    const created = await repository.create(userId, sessionId, bookId, {
      rating: 4,
      text: 'Original',
    });

    const edited = await repository.edit(created.id, { text: null });
    expect(edited.text).toBeNull();
  });

  it('deletes a review', async () => {
    const created = await repository.create(userId, sessionId, bookId, { rating: 4 });

    await repository.delete(created.id);
    expect(await repository.findById(created.id)).toBeNull();
  });

  it('deletes by sessionId idempotently', async () => {
    await repository.create(userId, sessionId, bookId, { rating: 4 });

    await repository.deleteBySessionId(sessionId);
    expect(await repository.findBySessionId(sessionId)).toBeNull();

    await expect(repository.deleteBySessionId(sessionId)).resolves.toBeUndefined();
  });

  it('returns null average and zero count for a book with no reviews', async () => {
    expect(await repository.getAggregatesByBook(otherBookId)).toEqual({
      averageRating: null,
      reviewCount: 0,
    });
  });

  it('computes real average and count, rounded to 1 decimal place', async () => {
    await repository.create(userId, sessionId, bookId, { rating: 4 });
    await repository.create(userId, otherSessionId, bookId, { rating: 5 });
    await repository.create(userId, '507f1f77bcf86cd799439066', bookId, { rating: 5 });

    expect(await repository.getAggregatesByBook(bookId)).toEqual({
      averageRating: 4.7,
      reviewCount: 3,
    });
  });
});
