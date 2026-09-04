import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoUserRepository } from '../../../../src/repositories/users';
import { makeSearchUsers } from '../../../../src/services/users';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('search-users service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let userRepository: MongoUserRepository;
  let searchUsers: ReturnType<typeof makeSearchUsers>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('search_users_service_test');
    await ensureAuthIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('users').deleteMany({});
    userRepository = new MongoUserRepository(db);
    searchUsers = makeSearchUsers({ userRepository });
  });

  it('delegates to userRepository.search and sets avatarUrl: null on every item (D9)', async () => {
    await userRepository.create({
      email: 'bob@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'bob',
      displayName: 'Bob',
    });

    const result = await searchUsers({ q: 'Bob', page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({ id: expect.any(String), handle: 'bob', displayName: 'Bob', avatarUrl: null });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.totalItems).toBe(1);
  });

  it('passes page/limit through and returns an empty page with no match', async () => {
    const result = await searchUsers({ q: 'nonexistent-term-xyz', page: 1, limit: 20 });
    expect(result.items).toEqual([]);
    expect(result.totalItems).toBe(0);
  });
});
