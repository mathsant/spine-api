import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { InvalidReadingSessionStateError, ReadingSessionNotFoundError } from '../../../../src/errors';
import { MongoReadingSessionRepository } from '../../../../src/repositories/reading-sessions';
import { makeUpdateProgress } from '../../../../src/services/reading-sessions';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const userId = '507f1f77bcf86cd799439011';
const otherUserId = '507f1f77bcf86cd799439099';
const bookId = '507f1f77bcf86cd799439022';

describe('update-progress service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let readingSessionRepository: MongoReadingSessionRepository;
  let updateProgress: ReturnType<typeof makeUpdateProgress>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('update_progress_service_test');
    await ensureBookIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('reading_sessions').deleteMany({});
    readingSessionRepository = new MongoReadingSessionRepository(db);
    updateProgress = makeUpdateProgress({ readingSessionRepository });
  });

  it('updates currentPage on a reading session owned by the user', async () => {
    const session = await readingSessionRepository.startReading(userId, bookId, new Date());
    const result = await updateProgress({ userId, sessionId: session.id, currentPage: 120 });
    expect(result.currentPage).toBe(120);
  });

  it('rejects a session that is not reading (RF-012)', async () => {
    const session = await readingSessionRepository.createFinished(userId, bookId, {
      startedAt: null,
      finishedAt: new Date(),
    });
    await expect(
      updateProgress({ userId, sessionId: session.id, currentPage: 10 }),
    ).rejects.toBeInstanceOf(InvalidReadingSessionStateError);
  });

  it('treats another user\'s session as not found (D9)', async () => {
    const session = await readingSessionRepository.startReading(otherUserId, bookId, new Date());
    await expect(
      updateProgress({ userId, sessionId: session.id, currentPage: 10 }),
    ).rejects.toBeInstanceOf(ReadingSessionNotFoundError);
  });

  it('rejects an unknown sessionId', async () => {
    await expect(
      updateProgress({ userId, sessionId: '507f1f77bcf86cd799439000', currentPage: 10 }),
    ).rejects.toBeInstanceOf(ReadingSessionNotFoundError);
  });
});
