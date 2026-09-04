import { ObjectId, type Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ACCESS_TOKEN_TTL_SECONDS, signAccessToken } from '../../../../src/auth';
import { InvalidAccessTokenError } from '../../../../src/errors';
import { MongoUserRepository } from '../../../../src/repositories/users';
import { makeAuthenticate } from '../../../../src/services/auth';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const SECRET = 'authenticate-service-secret-0123456789ab';

describe('authenticate service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let authenticate: ReturnType<typeof makeAuthenticate>;
  let userId: string;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('authenticate_service_test');
    await ensureAuthIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('users').deleteMany({});
    const userRepository = new MongoUserRepository(db);
    const user = await userRepository.create({
      email: 'alice@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'alice',
      displayName: 'Alice',
    });
    userId = user.id;
    authenticate = makeAuthenticate({ userRepository, config: { accessTokenSecret: SECRET } });
  });

  it('returns the public user for a valid token', async () => {
    const token = signAccessToken({ userId }, SECRET);

    const user = await authenticate(token);

    expect(user).toEqual({
      id: userId,
      email: 'alice@example.com',
      handle: 'alice',
      displayName: 'Alice',
      createdAt: expect.any(Date),
    });
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('rejects a token whose account no longer exists', async () => {
    const token = signAccessToken({ userId: new ObjectId().toHexString() }, SECRET);

    await expect(authenticate(token)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('rejects an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - ACCESS_TOKEN_TTL_SECONDS - 60;
    const token = signAccessToken({ userId }, SECRET, past);

    await expect(authenticate(token)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = signAccessToken({ userId }, 'some-other-secret-0123456789abcdef!!');

    await expect(authenticate(token)).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });
});
