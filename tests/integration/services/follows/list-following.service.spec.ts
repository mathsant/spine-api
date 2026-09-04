import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { MongoUserRepository } from '../../../../src/repositories/users';
import { makeListFollowing } from '../../../../src/services/follows';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('list-following service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let userRepository: MongoUserRepository;
  let followRepository: MongoFollowRepository;
  let listFollowing: ReturnType<typeof makeListFollowing>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('list_following_service_test');
    await ensureAuthIndexes(db);
    await ensureFollowIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(['users', 'follows'].map((c) => db.collection(c).deleteMany({})));
    userRepository = new MongoUserRepository(db);
    followRepository = new MongoFollowRepository(db);
    listFollowing = makeListFollowing({ followRepository, userRepository });
  });

  async function createUser(handle: string) {
    return userRepository.create({
      email: `${handle}@example.com`,
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle,
      displayName: handle,
    });
  }

  it('lists who userId follows (approved), resolving handle/displayName, paginated by cursor', async () => {
    const alice = await createUser('alice');
    const bob = await createUser('bob');
    await followRepository.create(alice.id, bob.id, new Date());

    const result = await listFollowing({ userId: alice.id, cursor: null, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ userId: bob.id, handle: 'bob', displayName: 'bob' });
    expect(result.nextCursor).toBeNull();
  });
});
