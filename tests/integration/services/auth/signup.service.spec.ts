import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { EmailAlreadyInUseError, HandleAlreadyInUseError } from '../../../../src/errors';
import { MongoUserRepository, type UserRepository } from '../../../../src/repositories/users';
import { makeSignup } from '../../../../src/services/auth';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const input = {
  email: '  Alice@Example.com ',
  password: 'correct horse battery',
  handle: 'Alice',
  displayName: '  Alice  ',
};

describe('signup service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let userRepository: MongoUserRepository;
  let signup: ReturnType<typeof makeSignup>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('signup_service_test');
    await ensureAuthIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('users').deleteMany({});
    userRepository = new MongoUserRepository(db);
    signup = makeSignup({ userRepository });
  });

  it('creates the account with a normalised email and handle, no tokens, no hash', async () => {
    const user = await signup(input);

    expect(user).toEqual({
      id: expect.any(String),
      email: 'alice@example.com',
      handle: 'alice',
      displayName: 'Alice',
      createdAt: expect.any(Date),
    });
    expect(user).not.toHaveProperty('passwordHash');
    expect(user).not.toHaveProperty('accessToken');

    const stored = await userRepository.findByEmail('alice@example.com');
    expect(stored?.passwordHash).toMatch(/^scrypt\$/);
  });

  it('rejects a duplicate email (pre-check)', async () => {
    await signup(input);
    await expect(signup({ ...input, handle: 'other' })).rejects.toBeInstanceOf(
      EmailAlreadyInUseError,
    );
  });

  it('rejects a handle that already exists in a different case (D9)', async () => {
    await signup({ ...input, handle: 'alice' });
    await expect(
      signup({ ...input, email: 'someone@else.com', handle: 'ALICE' }),
    ).rejects.toBeInstanceOf(HandleAlreadyInUseError);
  });

  it('propagates the repository error raised by the unique-index race backstop', async () => {
    const racingRepo: UserRepository = {
      findByEmail: async () => null,
      findByHandle: async () => null,
      findById: async () => null,
      updatePasswordHash: async () => undefined,
      create: async () => {
        throw new HandleAlreadyInUseError();
      },
    };

    await expect(makeSignup({ userRepository: racingRepo })(input)).rejects.toBeInstanceOf(
      HandleAlreadyInUseError,
    );
  });
});
