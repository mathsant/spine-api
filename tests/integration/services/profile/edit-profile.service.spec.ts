import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoUserRepository } from '../../../../src/repositories/users';
import { makeEditProfile } from '../../../../src/services/profile';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const clock = { now: () => new Date('2025-06-01T00:00:00.000Z') };

describe('edit-profile service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let userRepository: MongoUserRepository;
  let editProfile: ReturnType<typeof makeEditProfile>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('edit_profile_service_test');
    await ensureAuthIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('users').deleteMany({});
    userRepository = new MongoUserRepository(db);
    editProfile = makeEditProfile({ userRepository, clock });
  });

  it('updates displayName and bio', async () => {
    const user = await userRepository.create({
      email: 'alice@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'alice',
      displayName: 'Alice',
    });

    const result = await editProfile({
      userId: user.id,
      displayName: 'Alice Reader',
      bio: 'Reading sci-fi',
    });

    expect(result).toEqual({
      id: user.id,
      handle: 'alice',
      displayName: 'Alice Reader',
      bio: 'Reading sci-fi',
    });
  });

  it('a partial update (only bio) preserves the current displayName', async () => {
    const user = await userRepository.create({
      email: 'bob@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'bob',
      displayName: 'Bob',
    });

    const result = await editProfile({ userId: user.id, bio: 'Hi there' });

    expect(result.displayName).toBe('Bob');
    expect(result.bio).toBe('Hi there');
  });
});
