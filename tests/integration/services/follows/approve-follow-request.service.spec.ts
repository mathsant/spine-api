import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FollowRequestNotFoundError } from '../../../../src/errors';
import { MongoFollowRequestRepository } from '../../../../src/repositories/follow-requests';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { makeApproveFollowRequest } from '../../../../src/services/follows';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const clock = { now: () => new Date('2025-06-01T00:00:00.000Z') };

describe('approve-follow-request service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let followRequestRepository: MongoFollowRequestRepository;
  let followRepository: MongoFollowRepository;
  let approveFollowRequest: ReturnType<typeof makeApproveFollowRequest>;

  const requesterId = '507f1f77bcf86cd799439011';
  const targetId = '507f1f77bcf86cd799439012';

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('approve_follow_request_service_test');
    await ensureFollowIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(['follow_requests', 'follows'].map((c) => db.collection(c).deleteMany({})));
    followRequestRepository = new MongoFollowRequestRepository(db);
    followRepository = new MongoFollowRepository(db);
    approveFollowRequest = makeApproveFollowRequest({ followRequestRepository, followRepository, clock });
  });

  it('approves a pending request: creates Follow (requester -> target) and deletes the request', async () => {
    await followRequestRepository.create(requesterId, targetId, new Date());

    await approveFollowRequest({ targetId, requesterId });

    expect(await followRequestRepository.findByPair(requesterId, targetId)).toBeNull();
    expect(await followRepository.exists(requesterId, targetId)).toBe(true);
  });

  it('does not create the reverse relation (RF-011)', async () => {
    await followRequestRepository.create(requesterId, targetId, new Date());
    await approveFollowRequest({ targetId, requesterId });

    expect(await followRepository.exists(targetId, requesterId)).toBe(false);
  });

  it('rejects when there is no pending request for the pair', async () => {
    await expect(approveFollowRequest({ targetId, requesterId })).rejects.toBeInstanceOf(
      FollowRequestNotFoundError,
    );
  });
});
