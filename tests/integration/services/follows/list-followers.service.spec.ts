import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoFollowRequestRepository } from '../../../../src/repositories/follow-requests';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { MongoUserRepository } from '../../../../src/repositories/users';
import { makeListFollowers } from '../../../../src/services/follows';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('list-followers service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let userRepository: MongoUserRepository;
  let followRepository: MongoFollowRepository;
  let followRequestRepository: MongoFollowRequestRepository;
  let listFollowers: ReturnType<typeof makeListFollowers>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('list_followers_service_test');
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
    listFollowers = makeListFollowers({ followRepository, followRequestRepository, userRepository });
  });

  async function createUser(handle: string) {
    return userRepository.create({
      email: `${handle}@example.com`,
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle,
      displayName: handle,
    });
  }

  it('lists who follows userId (approved), resolving handle/displayName, paginated by cursor', async () => {
    const alice = await createUser('alice');
    const bob = await createUser('bob');
    await followRepository.create(bob.id, alice.id, new Date());

    const result = await listFollowers({ userId: alice.id, cursor: null, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ userId: bob.id, handle: 'bob', displayName: 'bob' });
    expect(result.nextCursor).toBeNull();
  });

  it('each item carries followsYou always true, and followState indicating follow-back (scenario 24)', async () => {
    const alice = await createUser('alice');
    const bob = await createUser('bob');
    const carol = await createUser('carol');
    await followRepository.create(bob.id, alice.id, new Date());
    await followRepository.create(carol.id, alice.id, new Date());
    await followRepository.create(alice.id, bob.id, new Date()); // alice follows bob back

    const result = await listFollowers({ userId: alice.id, cursor: null, limit: 20 });
    const byId = new Map(result.items.map((item) => [item.userId, item]));

    expect(result.items.every((item) => item.followsYou === true)).toBe(true);
    expect(byId.get(bob.id)?.followState).toBe('following');
    expect(byId.get(carol.id)?.followState).toBe('none');
  });
});
