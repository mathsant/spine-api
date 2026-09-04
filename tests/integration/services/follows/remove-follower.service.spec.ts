import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FollowNotFoundError } from '../../../../src/errors';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { makeRemoveFollower } from '../../../../src/services/follows';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('remove-follower service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let followRepository: MongoFollowRepository;
  let removeFollower: ReturnType<typeof makeRemoveFollower>;

  const followerId = '507f1f77bcf86cd799439011';
  const followeeId = '507f1f77bcf86cd799439012';

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('remove_follower_service_test');
    await ensureFollowIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('follows').deleteMany({});
    followRepository = new MongoFollowRepository(db);
    removeFollower = makeRemoveFollower({ followRepository });
  });

  it('removes a follow relation in the opposite direction (follower -> me)', async () => {
    await followRepository.create(followerId, followeeId, new Date());
    await removeFollower({ followeeId, followerId });
    expect(await followRepository.exists(followerId, followeeId)).toBe(false);
  });

  it('rejects when there is no approved relation for the pair', async () => {
    await expect(removeFollower({ followeeId, followerId })).rejects.toBeInstanceOf(
      FollowNotFoundError,
    );
  });
});
