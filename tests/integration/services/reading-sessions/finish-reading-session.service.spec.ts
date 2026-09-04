import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ReadingSessionNotFoundError } from '../../../../src/errors';
import { MongoReadingSessionRepository } from '../../../../src/repositories/reading-sessions';
import { makeFinishReadingSession } from '../../../../src/services/reading-sessions';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const userId = '507f1f77bcf86cd799439011';
const otherUserId = '507f1f77bcf86cd799439099';
const bookId = '507f1f77bcf86cd799439022';

describe('finish-reading-session service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let readingSessionRepository: MongoReadingSessionRepository;
  let finishReadingSession: ReturnType<typeof makeFinishReadingSession>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('finish_reading_session_service_test');
    await ensureBookIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('reading_sessions').deleteMany({});
    readingSessionRepository = new MongoReadingSessionRepository(db);
    finishReadingSession = makeFinishReadingSession({
      readingSessionRepository,
      clock: { now: () => new Date('2025-06-01T00:00:00.000Z') },
    });
  });

  it('finishes an open session owned by the user, defaulting finishedAt to now', async () => {
    const session = await readingSessionRepository.startReading(userId, bookId, new Date());
    const result = await finishReadingSession({ userId, sessionId: session.id });

    expect(result).toMatchObject({ status: 'finished', finishedAt: '2025-06-01T00:00:00.000Z' });
  });

  it('accepts an explicit finishedAt', async () => {
    const session = await readingSessionRepository.startReading(userId, bookId, new Date());
    const result = await finishReadingSession({
      userId,
      sessionId: session.id,
      finishedAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    expect(result.finishedAt).toBe('2025-01-01T00:00:00.000Z');
  });

  it('is idempotent when the session is already finished', async () => {
    const session = await readingSessionRepository.startReading(userId, bookId, new Date());
    await finishReadingSession({ userId, sessionId: session.id, finishedAt: new Date('2025-01-01T00:00:00.000Z') });

    const result = await finishReadingSession({
      userId,
      sessionId: session.id,
      finishedAt: new Date('2025-02-01T00:00:00.000Z'),
    });
    expect(result.finishedAt).toBe('2025-02-01T00:00:00.000Z');
  });

  it('treats another user\'s session as not found (D9)', async () => {
    const session = await readingSessionRepository.startReading(otherUserId, bookId, new Date());
    await expect(
      finishReadingSession({ userId, sessionId: session.id }),
    ).rejects.toBeInstanceOf(ReadingSessionNotFoundError);
  });
});
