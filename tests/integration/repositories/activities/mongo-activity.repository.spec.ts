import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoActivityRepository } from '../../../../src/repositories/activities';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const actorA = '507f1f77bcf86cd799439011';
const actorB = '507f1f77bcf86cd799439012';
const actorC = '507f1f77bcf86cd799439013';
const bookId = '507f1f77bcf86cd799439021';
const sessionId = '507f1f77bcf86cd799439031';
const otherSessionId = '507f1f77bcf86cd799439032';

describe('MongoActivityRepository (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let repo: MongoActivityRepository;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('mongo_activity_repository_test');
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('activities').deleteMany({});
    repo = new MongoActivityRepository(db);
  });

  it('record inserts currentPage only for progress_update', async () => {
    const started = await repo.record(
      { type: 'started_reading', actorId: actorA, bookId, readingSessionId: sessionId },
      new Date(),
    );
    expect(started.currentPage).toBeNull();

    const progress = await repo.record(
      { type: 'progress_update', actorId: actorA, bookId, readingSessionId: sessionId, currentPage: 120 },
      new Date(),
    );
    expect(progress.currentPage).toBe(120);
    expect(progress.type).toBe('progress_update');
  });

  it('listForActors filters by actorId $in and orders createdAt desc', async () => {
    const now = Date.now();
    await repo.record(
      { type: 'started_reading', actorId: actorA, bookId, readingSessionId: sessionId },
      new Date(now),
    );
    await repo.record(
      { type: 'finished_reading', actorId: actorB, bookId, readingSessionId: otherSessionId },
      new Date(now + 1000),
    );
    await repo.record(
      { type: 'started_reading', actorId: actorC, bookId, readingSessionId: 'irrelevant' },
      new Date(now + 2000),
    );

    const page = await repo.listForActors([actorA, actorB], null, 20);
    expect(page.items.map((item) => item.actorId)).toEqual([actorB, actorA]);
    expect(page.nextCursor).toBeNull();
  });

  it('paginates by cursor without duplicating or skipping items when a newer one is inserted mid-pagination (scenario 11)', async () => {
    const now = Date.now();
    await repo.record(
      { type: 'started_reading', actorId: actorA, bookId, readingSessionId: sessionId },
      new Date(now),
    );
    await repo.record(
      { type: 'progress_update', actorId: actorA, bookId, readingSessionId: sessionId, currentPage: 50 },
      new Date(now + 1000),
    );

    const firstPage = await repo.listForActors([actorA], null, 1);
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.items[0].currentPage).toBe(50);
    expect(firstPage.nextCursor).not.toBeNull();

    // A newer event is inserted before the second page is fetched — must not appear on it,
    // and the previously-seen item must not be duplicated or skipped.
    await repo.record(
      { type: 'finished_reading', actorId: actorA, bookId, readingSessionId: sessionId },
      new Date(now + 2000),
    );

    const secondPage = await repo.listForActors([actorA], firstPage.nextCursor, 1);
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].type).toBe('started_reading');
    expect(secondPage.nextCursor).toBeNull();
  });

  it('deleteBySessionId removes every type of event for that session', async () => {
    await repo.record(
      { type: 'started_reading', actorId: actorA, bookId, readingSessionId: sessionId },
      new Date(),
    );
    await repo.record(
      { type: 'progress_update', actorId: actorA, bookId, readingSessionId: sessionId, currentPage: 10 },
      new Date(),
    );
    await repo.record(
      { type: 'review_published', actorId: actorA, bookId, readingSessionId: sessionId },
      new Date(),
    );
    await repo.record(
      { type: 'started_reading', actorId: actorA, bookId, readingSessionId: otherSessionId },
      new Date(),
    );

    await repo.deleteBySessionId(sessionId);

    const page = await repo.listForActors([actorA], null, 20);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].readingSessionId).toBe(otherSessionId);
  });

  it('deleteBySessionIdAndType removes only the given type, keeping the others', async () => {
    await repo.record(
      { type: 'started_reading', actorId: actorA, bookId, readingSessionId: sessionId },
      new Date(),
    );
    await repo.record(
      { type: 'review_published', actorId: actorA, bookId, readingSessionId: sessionId },
      new Date(),
    );

    await repo.deleteBySessionIdAndType(sessionId, 'review_published');

    const page = await repo.listForActors([actorA], null, 20);
    expect(page.items.map((item) => item.type)).toEqual(['started_reading']);
  });
});
