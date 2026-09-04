import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FollowNotFoundError } from '../../../../src/errors';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { makeUnfollow } from '../../../../src/services/follows';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('unfollow service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let followRepository: MongoFollowRepository;
  let unfollow: ReturnType<typeof makeUnfollow>;

  const followerId = '507f1f77bcf86cd799439011';
  const followeeId = '507f1f77bcf86cd799439012';

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('unfollow_service_test');
    await ensureFollowIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('follows').deleteMany({});
    followRepository = new MongoFollowRepository(db);
    unfollow = makeUnfollow({ followRepository });
  });

  it('removes an existing follow relation', async () => {
    await followRepository.create(followerId, followeeId, new Date());
    await unfollow({ followerId, followeeId });
    expect(await followRepository.exists(followerId, followeeId)).toBe(false);
  });

  it('rejects when there is no approved relation for the pair', async () => {
    await expect(unfollow({ followerId, followeeId })).rejects.toBeInstanceOf(FollowNotFoundError);
  });
});
