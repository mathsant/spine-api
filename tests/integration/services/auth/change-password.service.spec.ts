import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { generateRefreshToken, hashPassword, verifyPassword } from '../../../../src/auth';
import { InvalidCredentialsError } from '../../../../src/errors';
import { MongoAuthSessionRepository } from '../../../../src/repositories/auth-sessions';
import { MongoUserRepository } from '../../../../src/repositories/users';
import { makeChangePassword } from '../../../../src/services/auth';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const DAY = 24 * 60 * 60 * 1000;

describe('change-password service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let users: MongoUserRepository;
  let sessions: MongoAuthSessionRepository;
  let changePassword: ReturnType<typeof makeChangePassword>;
  let userId: string;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('change_password_service_test');
    await ensureAuthIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('users').deleteMany({});
    await db.collection('auth_sessions').deleteMany({});
    await db.collection('refresh_tokens').deleteMany({});

    users = new MongoUserRepository(db);
    sessions = new MongoAuthSessionRepository(db);
    changePassword = makeChangePassword({
      userRepository: users,
      authSessionRepository: sessions,
      clock: { now: () => new Date('2026-09-03T00:00:00.000Z') },
    });

    const user = await users.create({
      email: 'alice@example.com',
      passwordHash: await hashPassword('old password'),
      handle: 'alice',
      displayName: 'Alice',
    });
    userId = user.id;
  });

  async function openSession() {
    const { token, tokenHash } = generateRefreshToken();
    const { sessionId } = await sessions.createSession({
      userId,
      refreshTokenHash: tokenHash,
      now: new Date(),
      inactivityExpiresAt: new Date(Date.now() + 30 * DAY),
      refreshExpiresAt: new Date(Date.now() + 30 * DAY),
    });
    return { token, sessionId };
  }

  it('sets the new hash and revokes the other sessions, sparing the current one', async () => {
    const current = await openSession();
    const other = await openSession();

    await changePassword({
      userId,
      currentPassword: 'old password',
      newPassword: 'a fresh password',
      refreshToken: current.token,
    });

    expect(await verifyPassword('a fresh password', (await users.findById(userId))!.passwordHash)).toBe(
      true,
    );
    expect((await sessions.findSessionById(current.sessionId))?.status).toBe('active');
    expect((await sessions.findSessionById(other.sessionId))?.status).toBe('revoked');
  });

  it('revokes every session when no refreshToken is given', async () => {
    const a = await openSession();
    const b = await openSession();

    await changePassword({ userId, currentPassword: 'old password', newPassword: 'a fresh password' });

    expect((await sessions.findSessionById(a.sessionId))?.status).toBe('revoked');
    expect((await sessions.findSessionById(b.sessionId))?.status).toBe('revoked');
  });

  it('ignores a refreshToken that belongs to another account (revokes all)', async () => {
    const mine = await openSession();
    const otherUser = await users.create({
      email: 'bob@example.com',
      passwordHash: await hashPassword('bob pw'),
      handle: 'bob',
      displayName: 'Bob',
    });
    const { token: bobToken, tokenHash } = generateRefreshToken();
    await sessions.createSession({
      userId: otherUser.id,
      refreshTokenHash: tokenHash,
      now: new Date(),
      inactivityExpiresAt: new Date(Date.now() + 30 * DAY),
      refreshExpiresAt: new Date(Date.now() + 30 * DAY),
    });

    await changePassword({
      userId,
      currentPassword: 'old password',
      newPassword: 'a fresh password',
      refreshToken: bobToken,
    });

    expect((await sessions.findSessionById(mine.sessionId))?.status).toBe('revoked');
  });

  it('rejects a wrong current password and leaves the hash untouched', async () => {
    const before = (await users.findById(userId))!.passwordHash;

    await expect(
      changePassword({ userId, currentPassword: 'wrong', newPassword: 'a fresh password' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect((await users.findById(userId))!.passwordHash).toBe(before);
  });
});
