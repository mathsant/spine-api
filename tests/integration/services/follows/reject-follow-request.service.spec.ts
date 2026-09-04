import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FollowRequestNotFoundError } from '../../../../src/errors';
import { MongoFollowRequestRepository } from '../../../../src/repositories/follow-requests';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { makeRejectFollowRequest } from '../../../../src/services/follows';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('reject-follow-request service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let followRequestRepository: MongoFollowRequestRepository;
  let followRepository: MongoFollowRepository;
  let rejectFollowRequest: ReturnType<typeof makeRejectFollowRequest>;

  const requesterId = '507f1f77bcf86cd799439011';
  const targetId = '507f1f77bcf86cd799439012';

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('reject_follow_request_service_test');
    await ensureFollowIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(['follow_requests', 'follows'].map((c) => db.collection(c).deleteMany({})));
    followRequestRepository = new MongoFollowRequestRepository(db);
    followRepository = new MongoFollowRepository(db);
    rejectFollowRequest = makeRejectFollowRequest({ followRequestRepository });
  });

  it('rejects (deletes) a pending request without creating a Follow', async () => {
    await followRequestRepository.create(requesterId, targetId, new Date());

    await rejectFollowRequest({ targetId, requesterId });

    expect(await followRequestRepository.findByPair(requesterId, targetId)).toBeNull();
    expect(await followRepository.exists(requesterId, targetId)).toBe(false);
  });

  it('rejects when there is no pending request for the pair', async () => {
    await expect(rejectFollowRequest({ targetId, requesterId })).rejects.toBeInstanceOf(
      FollowRequestNotFoundError,
    );
  });
});
