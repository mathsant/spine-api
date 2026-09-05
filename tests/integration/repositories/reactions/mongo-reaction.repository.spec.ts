import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoReactionRepository } from '../../../../src/repositories/reactions';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const activityId = '507f1f77bcf86cd799439011';
const otherActivityId = '507f1f77bcf86cd799439012';
const sessionId = '507f1f77bcf86cd799439021';
const userId = '507f1f77bcf86cd799439031';
const otherUserId = '507f1f77bcf86cd799439032';

describe('MongoReactionRepository (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let repo: MongoReactionRepository;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('mongo_reaction_repository_test');
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('reactions').deleteMany({});
    repo = new MongoReactionRepository(db);
  });

  it('add is idempotent — repeating does not duplicate (RF-002)', async () => {
    await repo.add(activityId, userId, sessionId, 'progress_update', new Date());
    await repo.add(activityId, userId, sessionId, 'progress_update', new Date());

    const counts = await repo.countByActivityIds([activityId]);
    expect(counts.get(activityId)).toBe(1);
  });

  it('remove returns true when something was removed, false otherwise (RF-003)', async () => {
    await repo.add(activityId, userId, sessionId, 'progress_update', new Date());

    expect(await repo.remove(activityId, userId)).toBe(true);
    expect(await repo.remove(activityId, userId)).toBe(false);
  });

  it('countByActivityIds counts per activity in one batch', async () => {
    await repo.add(activityId, userId, sessionId, 'progress_update', new Date());
    await repo.add(activityId, otherUserId, sessionId, 'progress_update', new Date());
    await repo.add(otherActivityId, userId, sessionId, 'progress_update', new Date());

    const counts = await repo.countByActivityIds([activityId, otherActivityId, 'unknown']);
    expect(counts.get(activityId)).toBe(2);
    expect(counts.get(otherActivityId)).toBe(1);
    expect(counts.get('unknown')).toBeUndefined();
  });

  it('listReactedActivityIds returns only the ids the user reacted to', async () => {
    await repo.add(activityId, userId, sessionId, 'progress_update', new Date());
    await repo.add(otherActivityId, otherUserId, sessionId, 'progress_update', new Date());

    const reacted = await repo.listReactedActivityIds(userId, [activityId, otherActivityId]);
    expect(reacted).toEqual([activityId]);
  });

  it('deleteByReadingSessionId removes every activityType of that session', async () => {
    await repo.add(activityId, userId, sessionId, 'progress_update', new Date());
    await repo.add(otherActivityId, userId, sessionId, 'review_published', new Date());

    await repo.deleteByReadingSessionId(sessionId);

    const counts = await repo.countByActivityIds([activityId, otherActivityId]);
    expect(counts.size).toBe(0);
  });

  it('deleteByReadingSessionIdAndType removes only the given type, keeping the others', async () => {
    await repo.add(activityId, userId, sessionId, 'progress_update', new Date());
    await repo.add(otherActivityId, userId, sessionId, 'review_published', new Date());

    await repo.deleteByReadingSessionIdAndType(sessionId, 'review_published');

    const counts = await repo.countByActivityIds([activityId, otherActivityId]);
    expect(counts.get(activityId)).toBe(1);
    expect(counts.get(otherActivityId)).toBeUndefined();
  });
});
