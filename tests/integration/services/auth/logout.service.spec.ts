import { ObjectId, type Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { generateRefreshToken } from '../../../../src/auth';
import { MongoAuthSessionRepository } from '../../../../src/repositories/auth-sessions';
import { makeLogout } from '../../../../src/services/auth';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const DAY = 24 * 60 * 60 * 1000;

describe('logout service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let sessions: MongoAuthSessionRepository;
  let logout: ReturnType<typeof makeLogout>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('logout_service_test');
    await ensureAuthIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('auth_sessions').deleteMany({});
    await db.collection('refresh_tokens').deleteMany({});
    sessions = new MongoAuthSessionRepository(db);
    logout = makeLogout({ authSessionRepository: sessions });
  });

  it('revokes the session behind the token and is idempotent', async () => {
    const now = new Date();
    const { token, tokenHash } = generateRefreshToken();
    const { sessionId } = await sessions.createSession({
      userId: new ObjectId().toHexString(),
      refreshTokenHash: tokenHash,
      now,
      inactivityExpiresAt: new Date(now.getTime() + 30 * DAY),
      refreshExpiresAt: new Date(now.getTime() + 30 * DAY),
    });

    await expect(logout({ refreshToken: token })).resolves.toBeUndefined();
    expect(await sessions.findSessionById(sessionId)).toMatchObject({
      status: 'revoked',
      revokedReason: 'logout',
    });

    await expect(logout({ refreshToken: token })).resolves.toBeUndefined();
  });

  it('resolves without error for an unknown token', async () => {
    await expect(logout({ refreshToken: 'not-a-real-token' })).resolves.toBeUndefined();
  });
});
