import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('MongoFollowRepository (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let repo: MongoFollowRepository;

  const followerId = '507f1f77bcf86cd799439011';
  const followeeId = '507f1f77bcf86cd799439012';
  const otherId = '507f1f77bcf86cd799439013';

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('follow_repo_test');
    await ensureFollowIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('follows').deleteMany({});
    repo = new MongoFollowRepository(db);
  });

  it('creates a follow relation', async () => {
    const record = await repo.create(followerId, followeeId, new Date());
    expect(record).toMatchObject({ followerId, followeeId });
    expect(typeof record.id).toBe('string');
  });

  it('exists returns true/false', async () => {
    await repo.create(followerId, followeeId, new Date());
    expect(await repo.exists(followerId, followeeId)).toBe(true);
    expect(await repo.exists(followeeId, followerId)).toBe(false);
    expect(await repo.exists(followerId, otherId)).toBe(false);
  });

  it('deleteByPair removes and returns the deleted record, null if absent', async () => {
    const created = await repo.create(followerId, followeeId, new Date());
    const deleted = await repo.deleteByPair(followerId, followeeId);
    expect(deleted?.id).toBe(created.id);
    expect(await repo.exists(followerId, followeeId)).toBe(false);
    expect(await repo.deleteByPair(followerId, followeeId)).toBeNull();
  });

  it('listByFollowee/listByFollower paginate by cursor (createdAt desc)', async () => {
    const now = Date.now();
    await repo.create(followerId, followeeId, new Date(now));
    await repo.create(otherId, followeeId, new Date(now + 1000));

    const followers = await repo.listByFollowee(followeeId, null, 20);
    expect(followers.items).toHaveLength(2);
    expect(followers.items[0].followerId).toBe(otherId);
    expect(followers.items[1].followerId).toBe(followerId);
    expect(followers.nextCursor).toBeNull();

    const following = await repo.listByFollower(followerId, null, 20);
    expect(following.items).toHaveLength(1);
    expect(following.items[0].followeeId).toBe(followeeId);
  });

  it('listFolloweeIds returns all followee ids, unpaginated, [] if none', async () => {
    expect(await repo.listFolloweeIds(followerId)).toEqual([]);

    await repo.create(followerId, followeeId, new Date());
    await repo.create(followerId, otherId, new Date());

    const ids = await repo.listFolloweeIds(followerId);
    expect(ids.sort()).toEqual([followeeId, otherId].sort());
  });
});
