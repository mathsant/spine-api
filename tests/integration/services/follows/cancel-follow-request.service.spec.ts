import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FollowRequestNotFoundError } from '../../../../src/errors';
import { MongoFollowRequestRepository } from '../../../../src/repositories/follow-requests';
import { makeCancelFollowRequest } from '../../../../src/services/follows';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('cancel-follow-request service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let followRequestRepository: MongoFollowRequestRepository;
  let cancelFollowRequest: ReturnType<typeof makeCancelFollowRequest>;

  const requesterId = '507f1f77bcf86cd799439011';
  const targetId = '507f1f77bcf86cd799439012';

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('cancel_follow_request_service_test');
    await ensureFollowIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('follow_requests').deleteMany({});
    followRequestRepository = new MongoFollowRequestRepository(db);
    cancelFollowRequest = makeCancelFollowRequest({ followRequestRepository });
  });

  it('cancels a pending request I sent', async () => {
    await followRequestRepository.create(requesterId, targetId, new Date());
    await cancelFollowRequest({ requesterId, targetId });
    expect(await followRequestRepository.findByPair(requesterId, targetId)).toBeNull();
  });

  it('rejects when there is no pending request for the pair', async () => {
    await expect(cancelFollowRequest({ requesterId, targetId })).rejects.toBeInstanceOf(
      FollowRequestNotFoundError,
    );
  });
});
