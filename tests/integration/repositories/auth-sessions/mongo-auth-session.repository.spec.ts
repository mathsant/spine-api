import { ObjectId, type Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoAuthSessionRepository } from '../../../../src/repositories/auth-sessions';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const DAY = 24 * 60 * 60 * 1000;

describe('MongoAuthSessionRepository (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let repo: MongoAuthSessionRepository;
  const userId = new ObjectId().toHexString();

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('auth_session_repo_test');
    await ensureAuthIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('auth_sessions').deleteMany({});
    await db.collection('refresh_tokens').deleteMany({});
    repo = new MongoAuthSessionRepository(db);
  });

  async function seedSession(now = new Date()) {
    const { sessionId } = await repo.createSession({
      userId,
      refreshTokenHash: 'hash-1',
      now,
      inactivityExpiresAt: new Date(now.getTime() + 30 * DAY),
      refreshExpiresAt: new Date(now.getTime() + 30 * DAY),
    });
    return sessionId;
  }

  it('creates an active session with a first refresh-token link (rotatedAt null)', async () => {
    const sessionId = await seedSession();

    const session = await repo.findSessionById(sessionId);
    expect(session).toMatchObject({ userId, status: 'active' });

    const link = await repo.findRefreshTokenByHash('hash-1');
    expect(link).toMatchObject({ sessionId, userId, rotatedAt: null });
  });

  it('findRefreshTokenByHash / findSessionById return null when absent', async () => {
    expect(await repo.findRefreshTokenByHash('nope')).toBeNull();
    expect(await repo.findSessionById(new ObjectId().toHexString())).toBeNull();
  });

  it('rotate: succeeds once, stamps rotatedAt, inserts the new link, touches the session', async () => {
    const now = new Date();
    const sessionId = await seedSession(now);
    const link = await repo.findRefreshTokenByHash('hash-1');
    const rotateAt = new Date(now.getTime() + 1000);

    const res = await repo.rotate({
      currentTokenId: link!.id,
      sessionId,
      userId,
      newTokenHash: 'hash-2',
      now: rotateAt,
      inactivityExpiresAt: new Date(rotateAt.getTime() + 30 * DAY),
      refreshExpiresAt: new Date(rotateAt.getTime() + 30 * DAY),
    });

    expect(res).toEqual({ rotated: true });
    expect((await repo.findRefreshTokenByHash('hash-1'))?.rotatedAt).toBeInstanceOf(Date);
    expect(await repo.findRefreshTokenByHash('hash-2')).toMatchObject({ rotatedAt: null });
    expect((await repo.findSessionById(sessionId))?.inactivityExpiresAt.getTime()).toBe(
      rotateAt.getTime() + 30 * DAY,
    );
  });

  it('rotate: a second rotation of the same link reports rotated:false', async () => {
    const sessionId = await seedSession();
    const link = await repo.findRefreshTokenByHash('hash-1');
    const common = {
      currentTokenId: link!.id,
      sessionId,
      userId,
      now: new Date(),
      inactivityExpiresAt: new Date(Date.now() + 30 * DAY),
      refreshExpiresAt: new Date(Date.now() + 30 * DAY),
    };

    expect(await repo.rotate({ ...common, newTokenHash: 'hash-2' })).toEqual({ rotated: true });
    expect(await repo.rotate({ ...common, newTokenHash: 'hash-3' })).toEqual({ rotated: false });
  });

  it('revokeSession is idempotent and records the reason', async () => {
    const sessionId = await seedSession();

    await repo.revokeSession(sessionId, 'logout');
    await repo.revokeSession(sessionId, 'logout');

    expect(await repo.findSessionById(sessionId)).toMatchObject({
      status: 'revoked',
      revokedReason: 'logout',
    });
  });

  it('revokeAllUserSessions revokes every active session except the excepted one', async () => {
    const keep = await seedSession();
    const drop1 = await repo.createSession({
      userId,
      refreshTokenHash: 'hash-b',
      now: new Date(),
      inactivityExpiresAt: new Date(Date.now() + 30 * DAY),
      refreshExpiresAt: new Date(Date.now() + 30 * DAY),
    });
    const otherUser = await repo.createSession({
      userId: new ObjectId().toHexString(),
      refreshTokenHash: 'hash-c',
      now: new Date(),
      inactivityExpiresAt: new Date(Date.now() + 30 * DAY),
      refreshExpiresAt: new Date(Date.now() + 30 * DAY),
    });

    await repo.revokeAllUserSessions(userId, 'password_changed', { exceptSessionId: keep });

    expect((await repo.findSessionById(keep))?.status).toBe('active');
    expect((await repo.findSessionById(drop1.sessionId))?.status).toBe('revoked');
    expect((await repo.findSessionById(otherUser.sessionId))?.status).toBe('active');
  });
});
