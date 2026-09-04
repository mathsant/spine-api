import { ObjectId, type Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { generateRefreshToken, hashRefreshToken } from '../../../../src/auth';
import {
  InvalidRefreshTokenError,
  RefreshTokenExpiredError,
  RefreshTokenReuseDetectedError,
} from '../../../../src/errors';
import {
  type AuthSessionRepository,
  MongoAuthSessionRepository,
} from '../../../../src/repositories/auth-sessions';
import { makeRefresh } from '../../../../src/services/auth';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const SECRET = 'refresh-service-secret-0123456789abcdef';
const DAY = 24 * 60 * 60 * 1000;

describe('refresh service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let sessions: MongoAuthSessionRepository;
  let refresh: ReturnType<typeof makeRefresh>;
  const userId = new ObjectId().toHexString();
  const now = new Date('2026-09-03T00:00:00.000Z');

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('refresh_service_test');
    await ensureAuthIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('auth_sessions').deleteMany({});
    await db.collection('refresh_tokens').deleteMany({});
    sessions = new MongoAuthSessionRepository(db);
    refresh = makeRefresh({
      authSessionRepository: sessions,
      config: { accessTokenSecret: SECRET },
      clock: { now: () => now },
    });
  });

  async function seed(overrides: { inactivityExpiresAt?: Date } = {}) {
    const { token, tokenHash } = generateRefreshToken();
    const { sessionId } = await sessions.createSession({
      userId,
      refreshTokenHash: tokenHash,
      now,
      inactivityExpiresAt: overrides.inactivityExpiresAt ?? new Date(now.getTime() + 30 * DAY),
      refreshExpiresAt: new Date(now.getTime() + 30 * DAY),
    });
    return { token, tokenHash, sessionId };
  }

  it('rotates: returns a new pair, stamps the old link, renews the window', async () => {
    const { token, tokenHash, sessionId } = await seed();

    const pair = await refresh({ refreshToken: token });

    expect(pair).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    expect(pair.refreshToken).not.toBe(token);

    expect((await sessions.findRefreshTokenByHash(tokenHash))?.rotatedAt).toBeInstanceOf(Date);
    expect(await sessions.findRefreshTokenByHash(hashRefreshToken(pair.refreshToken))).toMatchObject(
      { rotatedAt: null },
    );
    expect((await sessions.findSessionById(sessionId))?.inactivityExpiresAt.getTime()).toBe(
      now.getTime() + 30 * DAY,
    );
  });

  it('detects reuse of an already-rotated link and revokes the whole session', async () => {
    const { token, sessionId } = await seed();
    await refresh({ refreshToken: token });

    await expect(refresh({ refreshToken: token })).rejects.toBeInstanceOf(
      RefreshTokenReuseDetectedError,
    );
    expect((await sessions.findSessionById(sessionId))?.status).toBe('revoked');
  });

  it('rejects a refresh on a session that is past its inactivity window', async () => {
    const { token, sessionId } = await seed({
      inactivityExpiresAt: new Date(now.getTime() - 1000),
    });

    await expect(refresh({ refreshToken: token })).rejects.toBeInstanceOf(RefreshTokenExpiredError);
    expect((await sessions.findSessionById(sessionId))?.status).toBe('revoked');
  });

  it('rejects an unknown token', async () => {
    await expect(refresh({ refreshToken: 'nope' })).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });

  it('rejects a token whose session was already revoked', async () => {
    const { token, sessionId } = await seed();
    await sessions.revokeSession(sessionId, 'logout');

    await expect(refresh({ refreshToken: token })).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });

  it('treats a lost rotation race (rotate → rotated:false) as reuse', async () => {
    const { token, tokenHash } = await seed();
    const link = await sessions.findRefreshTokenByHash(tokenHash);
    if (!link) {
      throw new Error('expected a seeded refresh-token link');
    }

    // rotate() loses the race (another refresh already rotated the link).
    const racing: Pick<
      AuthSessionRepository,
      'findRefreshTokenByHash' | 'findSessionById' | 'rotate' | 'revokeSession'
    > = {
      findRefreshTokenByHash: () => Promise.resolve(link),
      findSessionById: () =>
        Promise.resolve({
          sessionId: link.sessionId,
          userId,
          status: 'active',
          createdAt: now,
          lastUsedAt: now,
          inactivityExpiresAt: new Date(now.getTime() + 30 * DAY),
        }),
      rotate: () => Promise.resolve({ rotated: false }),
      revokeSession: (sessionId, reason) => sessions.revokeSession(sessionId, reason),
    };

    await expect(
      makeRefresh({
        authSessionRepository: racing,
        config: { accessTokenSecret: SECRET },
        clock: { now: () => now },
      })({ refreshToken: token }),
    ).rejects.toBeInstanceOf(RefreshTokenReuseDetectedError);

    expect((await sessions.findSessionById(link.sessionId))?.status).toBe('revoked');
  });
});
