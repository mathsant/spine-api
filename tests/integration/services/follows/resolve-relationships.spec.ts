import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoFollowRequestRepository } from '../../../../src/repositories/follow-requests';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { resolveRelationships } from '../../../../src/services/follows';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('resolveRelationships (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let followRepository: MongoFollowRepository;
  let followRequestRepository: MongoFollowRequestRepository;

  const me = '507f1f77bcf86cd799439011';
  const followed = '507f1f77bcf86cd799439012';
  const requested = '507f1f77bcf86cd799439013';
  const stranger = '507f1f77bcf86cd799439014';
  const follower = '507f1f77bcf86cd799439015';

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('resolve_relationships_test');
    await ensureFollowIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      ['follows', 'follow_requests'].map((c) => db.collection(c).deleteMany({})),
    );
    followRepository = new MongoFollowRepository(db);
    followRequestRepository = new MongoFollowRequestRepository(db);
  });

  const deps = () => ({ followRepository, followRequestRepository });

  it('returns an empty map for an empty candidate list without touching the database', async () => {
    const result = await resolveRelationships(me, [], deps());
    expect(result.size).toBe(0);
  });

  it('resolves followState per candidate: following > pending > none', async () => {
    await followRepository.create(me, followed, new Date());
    await followRequestRepository.create(me, requested, new Date());

    const result = await resolveRelationships(me, [followed, requested, stranger], deps());

    expect(result.get(followed)?.followState).toBe('following');
    expect(result.get(requested)?.followState).toBe('pending');
    expect(result.get(stranger)?.followState).toBe('none');
  });

  it('following wins over a stale pending request for the same pair', async () => {
    await followRepository.create(me, followed, new Date());
    await followRequestRepository.create(me, followed, new Date());

    const result = await resolveRelationships(me, [followed], deps());
    expect(result.get(followed)?.followState).toBe('following');
  });

  it('followsYou is true only for an approved follow candidate -> viewer', async () => {
    await followRepository.create(follower, me, new Date());
    await followRequestRepository.create(stranger, me, new Date());

    const result = await resolveRelationships(me, [follower, stranger], deps());

    expect(result.get(follower)?.followsYou).toBe(true);
    expect(result.get(stranger)?.followsYou).toBe(false);
  });

  it('the viewer among the candidates resolves to none / false', async () => {
    const result = await resolveRelationships(me, [me], deps());
    expect(result.get(me)).toEqual({ followState: 'none', followsYou: false });
  });
});
