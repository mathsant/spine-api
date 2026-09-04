import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { InvalidReadingSessionDatesError, ReadingSessionNotFoundError } from '../../../../src/errors';
import { MongoReadingSessionRepository } from '../../../../src/repositories/reading-sessions';
import { makeEditReadingSession } from '../../../../src/services/reading-sessions';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const userId = '507f1f77bcf86cd799439011';
const otherUserId = '507f1f77bcf86cd799439099';
const bookId = '507f1f77bcf86cd799439022';

describe('edit-reading-session service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let readingSessionRepository: MongoReadingSessionRepository;
  let editReadingSession: ReturnType<typeof makeEditReadingSession>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('edit_reading_session_service_test');
    await ensureBookIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('reading_sessions').deleteMany({});
    readingSessionRepository = new MongoReadingSessionRepository(db);
    editReadingSession = makeEditReadingSession({ readingSessionRepository });
  });

  it('edits fields of a session owned by the user', async () => {
    const session = await readingSessionRepository.startReading(userId, bookId, new Date('2025-01-01T00:00:00.000Z'));
    const result = await editReadingSession({ userId, sessionId: session.id, patch: { currentPage: 42 } });
    expect(result.currentPage).toBe(42);
  });

  it('rejects a resulting finishedAt before startedAt (RF-017)', async () => {
    const session = await readingSessionRepository.startReading(userId, bookId, new Date('2026-01-01T00:00:00.000Z'));
    await expect(
      editReadingSession({
        userId,
        sessionId: session.id,
        patch: { finishedAt: new Date('2025-01-01T00:00:00.000Z') },
      }),
    ).rejects.toBeInstanceOf(InvalidReadingSessionDatesError);
  });

  it('treats another user\'s session as not found (D9)', async () => {
    const session = await readingSessionRepository.startReading(otherUserId, bookId, new Date());
    await expect(
      editReadingSession({ userId, sessionId: session.id, patch: { currentPage: 1 } }),
    ).rejects.toBeInstanceOf(ReadingSessionNotFoundError);
  });
});
