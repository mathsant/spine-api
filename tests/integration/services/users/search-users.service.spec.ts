import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoFollowRequestRepository } from '../../../../src/repositories/follow-requests';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { MongoUserRepository } from '../../../../src/repositories/users';
import { makeSearchUsers } from '../../../../src/services/users';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('search-users service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let userRepository: MongoUserRepository;
  let followRepository: MongoFollowRepository;
  let followRequestRepository: MongoFollowRequestRepository;
  let searchUsers: ReturnType<typeof makeSearchUsers>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('search_users_service_test');
    await ensureAuthIndexes(db);
    await ensureFollowIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      ['users', 'follows', 'follow_requests'].map((c) => db.collection(c).deleteMany({})),
    );
    userRepository = new MongoUserRepository(db);
    followRepository = new MongoFollowRepository(db);
    followRequestRepository = new MongoFollowRequestRepository(db);
    searchUsers = makeSearchUsers({ userRepository, followRepository, followRequestRepository });
  });

  async function createUser(handle: string) {
    return userRepository.create({
      email: `${handle}@example.com`,
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle,
      displayName: handle,
    });
  }

  it('delegates to userRepository.search and sets avatarUrl: null and a relationship on every item', async () => {
    const viewer = await createUser('viewer');
    await createUser('bob');

    const result = await searchUsers({ viewerId: viewer.id, q: 'bob', page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      id: expect.any(String),
      handle: 'bob',
      displayName: 'bob',
      avatarUrl: null,
      followState: 'none',
      followsYou: false,
    });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.totalItems).toBe(1);
  });

  it('sets followState/followsYou per item relative to the viewer (scenario 22)', async () => {
    const viewer = await createUser('viewer');
    const followed = await createUser('followed');
    const requested = await createUser('requested');
    const backFollower = await createUser('backfollower');

    await followRepository.create(viewer.id, followed.id, new Date());
    await followRequestRepository.create(viewer.id, requested.id, new Date());
    await followRepository.create(backFollower.id, viewer.id, new Date());

    const following = await searchUsers({ viewerId: viewer.id, q: 'followed', page: 1, limit: 20 });
    expect(following.items[0]).toMatchObject({ followState: 'following', followsYou: false });

    const pending = await searchUsers({ viewerId: viewer.id, q: 'requested', page: 1, limit: 20 });
    expect(pending.items[0]).toMatchObject({ followState: 'pending', followsYou: false });

    const back = await searchUsers({ viewerId: viewer.id, q: 'backfollower', page: 1, limit: 20 });
    expect(back.items[0]).toMatchObject({ followState: 'none', followsYou: true });
  });

  it('passes page/limit through and returns an empty page with no match', async () => {
    const viewer = await createUser('viewer');
    const result = await searchUsers({
      viewerId: viewer.id,
      q: 'nonexistent-term-xyz',
      page: 1,
      limit: 20,
    });
    expect(result.items).toEqual([]);
    expect(result.totalItems).toBe(0);
  });
});
