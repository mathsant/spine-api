import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ReadingSessionNotFoundError } from '../../../../src/errors';
import { MongoActivityRepository } from '../../../../src/repositories/activities';
import { MongoReadingSessionRepository } from '../../../../src/repositories/reading-sessions';
import { MongoReviewRepository } from '../../../../src/repositories/reviews';
import { makeDeleteReadingSession } from '../../../../src/services/reading-sessions';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { ensureReviewIndexes } from '../../../helpers/review-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const userId = '507f1f77bcf86cd799439011';
const otherUserId = '507f1f77bcf86cd799439099';
const bookId = '507f1f77bcf86cd799439022';

describe('delete-reading-session service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let readingSessionRepository: MongoReadingSessionRepository;
  let reviewRepository: MongoReviewRepository;
  let activityRepository: MongoActivityRepository;
  let deleteReadingSession: ReturnType<typeof makeDeleteReadingSession>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('delete_reading_session_service_test');
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
    deleteReadingSession = makeDeleteReadingSession({
      readingSessionRepository,
      reviewRepository,
      activityRepository,
    });
  });

  it('deletes a session owned by the user', async () => {
    const session = await readingSessionRepository.startReading(userId, bookId, new Date());
    await deleteReadingSession({ userId, sessionId: session.id });
    expect(await readingSessionRepository.findById(session.id)).toBeNull();
  });

  it('treats another user\'s session as not found and does not delete it (D9)', async () => {
    const session = await readingSessionRepository.startReading(otherUserId, bookId, new Date());
    await expect(
      deleteReadingSession({ userId, sessionId: session.id }),
    ).rejects.toBeInstanceOf(ReadingSessionNotFoundError);

    expect(await readingSessionRepository.findById(session.id)).not.toBeNull();
  });

  it('cascades the delete to the review of the session (RF-007)', async () => {
    const session = await readingSessionRepository.createFinished(userId, bookId, {
      startedAt: null,
      finishedAt: new Date(),
    });
    const review = await reviewRepository.create(userId, session.id, bookId, { rating: 4 });

    await deleteReadingSession({ userId, sessionId: session.id });

    expect(await reviewRepository.findById(review.id)).toBeNull();
  });

  it('deletes a session with no review without error', async () => {
    const session = await readingSessionRepository.startReading(userId, bookId, new Date());

    await expect(deleteReadingSession({ userId, sessionId: session.id })).resolves.toBeUndefined();
  });

  it('cascades the delete to every activity event of the session (006, scenario 10)', async () => {
    const session = await readingSessionRepository.startReading(userId, bookId, new Date());
    await activityRepository.record(
      { type: 'started_reading', actorId: userId, bookId, readingSessionId: session.id },
      new Date(),
    );
    await activityRepository.record(
      { type: 'progress_update', actorId: userId, bookId, readingSessionId: session.id, currentPage: 10 },
      new Date(),
    );
    await activityRepository.record(
      { type: 'review_published', actorId: userId, bookId, readingSessionId: session.id },
      new Date(),
    );

    await deleteReadingSession({ userId, sessionId: session.id });

    const page = await activityRepository.listForActors([userId], null, 20);
    expect(page.items).toHaveLength(0);
  });
});
