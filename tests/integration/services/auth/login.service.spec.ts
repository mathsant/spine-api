import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ACCESS_TOKEN_TTL_SECONDS, hashPassword, verifyAccessToken } from '../../../../src/auth';
import { InvalidCredentialsError } from '../../../../src/errors';
import { MongoAuthSessionRepository } from '../../../../src/repositories/auth-sessions';
import { MongoUserRepository } from '../../../../src/repositories/users';
import { makeLogin } from '../../../../src/services/auth';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const SECRET = 'login-service-secret-0123456789abcdefgh';

describe('login service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let login: ReturnType<typeof makeLogin>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('login_service_test');
    await ensureAuthIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('users').deleteMany({});
    await db.collection('auth_sessions').deleteMany({});
    await db.collection('refresh_tokens').deleteMany({});

    const userRepository = new MongoUserRepository(db);
    await userRepository.create({
      email: 'alice@example.com',
      passwordHash: await hashPassword('correct horse'),
      handle: 'alice',
      displayName: 'Alice',
    });

    login = makeLogin({
      userRepository,
      authSessionRepository: new MongoAuthSessionRepository(db),
      config: { accessTokenSecret: SECRET },
      clock: { now: () => new Date('2026-09-03T00:00:00.000Z') },
    });
  });

  it('returns a token pair and creates one active session with a fresh link', async () => {
    const pair = await login({ email: 'ALICE@example.com', password: 'correct horse' });

    expect(pair).toMatchObject({ tokenType: 'Bearer', expiresIn: ACCESS_TOKEN_TTL_SECONDS });
    expect(verifyAccessToken(pair.accessToken, SECRET).userId).toEqual(expect.any(String));

    const sessions = await db.collection('auth_sessions').find({}).toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ status: 'active' });

    const links = await db.collection('refresh_tokens').find({}).toArray();
    expect(links).toHaveLength(1);
    expect(links[0].rotatedAt).toBeNull();
  });

  it('rejects a wrong password and an unknown email with the identical error', async () => {
    const wrongPassword = await login({ email: 'alice@example.com', password: 'nope' }).catch(
      (e: unknown) => e,
    );
    const unknownEmail = await login({ email: 'ghost@example.com', password: 'nope' }).catch(
      (e: unknown) => e,
    );

    expect(wrongPassword).toBeInstanceOf(InvalidCredentialsError);
    expect(unknownEmail).toBeInstanceOf(InvalidCredentialsError);
    expect((wrongPassword as Error).message).toBe((unknownEmail as Error).message);

    // No session is created on a failed login.
    expect(await db.collection('auth_sessions').countDocuments({})).toBe(0);
  });
});
