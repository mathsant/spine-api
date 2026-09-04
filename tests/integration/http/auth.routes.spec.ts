import { setTimeout as sleep } from 'node:timers/promises';

import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../../src/app';
import type { AppConfig } from '../../../src/config';
import { ACCESS_TOKEN_TTL_SECONDS, signAccessToken } from '../../../src/auth';
import { ensureAuthIndexes } from '../../helpers/auth-indexes';
import { testConfig } from '../../helpers/config';
import { type MongoMemory, startMongoMemory } from '../../helpers/mongo-memory';

const SECRET = testConfig().accessTokenSecret;

describe('auth routes (integration)', () => {
  let mongo: MongoMemory;
  let apps: FastifyInstance[] = [];

  beforeAll(async () => {
    mongo = await startMongoMemory();
    await ensureAuthIndexes(mongo.client.db('auth_routes_test'));
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    const db = mongo.client.db('auth_routes_test');
    await Promise.all(
      ['users', 'auth_sessions', 'refresh_tokens'].map((c) => db.collection(c).deleteMany({})),
    );
  });

  afterEach(async () => {
    await Promise.all(apps.map((a) => a.close()));
    apps = [];
  });

  async function build(overrides: Partial<AppConfig> = {}): Promise<FastifyInstance> {
    const app = await buildApp(
      testConfig({ mongoUri: mongo.uri, mongoDbName: 'auth_routes_test', ...overrides }),
    );
    apps.push(app);
    return app;
  }

  const signupBody = {
    email: 'alice@example.com',
    password: 'correct horse battery',
    handle: 'alice',
    displayName: 'Alice',
  };

  async function signup(app: FastifyInstance, body: Record<string, unknown> = signupBody) {
    return app.inject({ method: 'POST', url: '/v1/auth/signup', payload: body });
  }
  async function login(app: FastifyInstance, email = signupBody.email, password = signupBody.password) {
    return app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password } });
  }

  // ---- signup -------------------------------------------------------------

  it('signup: 201 with a public user and nothing sensitive', async () => {
    const app = await build({ authRateLimitMax: 100 });
    const res = await signup(app);

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({ email: 'alice@example.com', handle: 'alice', displayName: 'Alice' });
    expect(body).not.toHaveProperty('passwordHash');
    expect(body).not.toHaveProperty('accessToken');
  });

  it('signup: 409 EMAIL_ALREADY_IN_USE / 409 HANDLE_ALREADY_IN_USE', async () => {
    const app = await build({ authRateLimitMax: 100 });
    await signup(app);

    const dupEmail = await signup(app, { ...signupBody, handle: 'other' });
    expect(dupEmail.statusCode).toBe(409);
    expect(dupEmail.json().error.code).toBe('EMAIL_ALREADY_IN_USE');

    const dupHandle = await signup(app, { ...signupBody, email: 'x@y.com', handle: 'ALICE' });
    expect(dupHandle.statusCode).toBe(409);
    expect(dupHandle.json().error.code).toBe('HANDLE_ALREADY_IN_USE');
  });

  it('signup: 400 VALIDATION_ERROR for a bad body', async () => {
    const app = await build({ authRateLimitMax: 100 });
    const res = await signup(app, { email: 'x@y.z', password: 'short', handle: '!!', displayName: '' });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.json().error.details)).toBe(true);
  });

  it('signup: 429 TOO_MANY_REQUESTS once the per-IP limit is exceeded', async () => {
    const app = await build({ authRateLimitMax: 2 });

    await signup(app, { ...signupBody, email: 'a@x.com', handle: 'aa' });
    await signup(app, { ...signupBody, email: 'b@x.com', handle: 'bb' });
    const limited = await signup(app, { ...signupBody, email: 'c@x.com', handle: 'cc' });

    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe('TOO_MANY_REQUESTS');
  });

  // ---- login --------------------------------------------------------------

  it('login: 200 with a token pair', async () => {
    const app = await build({ authRateLimitMax: 100 });
    await signup(app);

    const res = await login(app);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ tokenType: 'Bearer', expiresIn: ACCESS_TOKEN_TTL_SECONDS });
    expect(typeof res.json().accessToken).toBe('string');
    expect(typeof res.json().refreshToken).toBe('string');
  });

  it('login: wrong password and unknown email give the identical 401 body', async () => {
    const app = await build({ authRateLimitMax: 100 });
    await signup(app);

    const wrong = await login(app, signupBody.email, 'nope');
    const unknown = await login(app, 'ghost@example.com', 'nope');

    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
    expect(wrong.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('login: 429 after the limit, keyed per IP + email', async () => {
    const app = await build({ authRateLimitMax: 1 });
    await signup(app);

    expect((await login(app, signupBody.email, 'nope')).statusCode).toBe(401);
    // same key (same email) -> limited
    expect((await login(app, signupBody.email, 'nope')).statusCode).toBe(429);
    // different email -> different key -> still evaluated (401, not 429)
    expect((await login(app, 'other@example.com', 'nope')).statusCode).toBe(401);
  });

  it('login: the rate-limit window expires on its own (RF-038)', async () => {
    const app = await build({ authRateLimitMax: 1, authRateLimitWindowMs: 300 });
    await signup(app);

    expect((await login(app, signupBody.email, 'nope')).statusCode).toBe(401);
    expect((await login(app, signupBody.email, 'nope')).statusCode).toBe(429);

    await sleep(400);
    expect((await login(app, signupBody.email, 'nope')).statusCode).toBe(401);
  });

  // ---- refresh ----------------------------------------------------------

  it('refresh: 200 rotates the pair; replay of the old token is 401 + session revoked', async () => {
    const app = await build({ authRateLimitMax: 100 });
    await signup(app);
    const { refreshToken } = (await login(app)).json();

    const rotated = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(rotated.statusCode).toBe(200);
    expect(rotated.json().refreshToken).not.toBe(refreshToken);

    const replay = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.json().error.code).toBe('REFRESH_TOKEN_REUSE_DETECTED');

    // the whole session is gone: the rotated token no longer works either
    const afterRevoke = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: rotated.json().refreshToken },
    });
    expect(afterRevoke.statusCode).toBe(401);
    expect(afterRevoke.json().error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('refresh: 401 REFRESH_TOKEN_EXPIRED past the inactivity window', async () => {
    const app = await build({ authRateLimitMax: 100 });
    await signup(app);
    const { refreshToken } = (await login(app)).json();

    await mongo.client
      .db('auth_routes_test')
      .collection('auth_sessions')
      .updateMany({}, { $set: { inactivityExpiresAt: new Date(Date.now() - 1000) } });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('REFRESH_TOKEN_EXPIRED');
  });

  it('refresh: 401 INVALID_REFRESH_TOKEN for an unknown token', async () => {
    const app = await build({ authRateLimitMax: 100 });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: 'nope' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  // ---- logout ---------------------------------------------------------

  it('logout: 204 then 204 again (idempotent); access token still valid until it expires', async () => {
    const app = await build({ authRateLimitMax: 100 });
    await signup(app);
    const { accessToken, refreshToken } = (await login(app)).json();

    const first = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: { refreshToken },
    });
    expect(first.statusCode).toBe(204);

    const refreshAfter = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(refreshAfter.statusCode).toBe(401);

    const second = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: { refreshToken },
    });
    expect(second.statusCode).toBe(204);

    const me = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${accessToken as string}` },
    });
    expect(me.statusCode).toBe(200);
  });

  it('logout: 204 for an unknown token', async () => {
    const app = await build({ authRateLimitMax: 100 });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: { refreshToken: 'unknown' },
    });
    expect(res.statusCode).toBe(204);
  });

  // ---- /me ----------------------------------------------------------

  it('GET /me: 200 for a valid token', async () => {
    const app = await build({ authRateLimitMax: 100 });
    await signup(app);
    const { accessToken } = (await login(app)).json();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${accessToken as string}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ email: 'alice@example.com', handle: 'alice' });
    expect(res.json()).not.toHaveProperty('passwordHash');
  });

  it('GET /me: 401 UNAUTHENTICATED without a header or with a non-Bearer scheme', async () => {
    const app = await build({ authRateLimitMax: 100 });

    const noHeader = await app.inject({ method: 'GET', url: '/v1/me' });
    expect(noHeader.statusCode).toBe(401);
    expect(noHeader.json().error.code).toBe('UNAUTHENTICATED');

    const basic = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: 'Basic abc' },
    });
    expect(basic.statusCode).toBe(401);
    expect(basic.json().error.code).toBe('UNAUTHENTICATED');
  });

  it('GET /me: 401 INVALID_ACCESS_TOKEN for an expired / tampered token', async () => {
    const app = await build({ authRateLimitMax: 100 });
    await signup(app);

    const expired = signAccessToken(
      { userId: '012345678901234567890123' },
      SECRET,
      Math.floor(Date.now() / 1000) - ACCESS_TOKEN_TTL_SECONDS - 60,
    );
    const res = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${expired}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_ACCESS_TOKEN');
  });

  // ---- change-password --------------------------------------------------

  it('change-password: 204, revokes the other sessions, keeps the current one', async () => {
    const app = await build({ authRateLimitMax: 100 });
    await signup(app);
    const current = (await login(app)).json();
    const other = (await login(app)).json();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-password',
      headers: { authorization: `Bearer ${current.accessToken as string}` },
      payload: {
        currentPassword: signupBody.password,
        newPassword: 'a brand new password',
        refreshToken: current.refreshToken,
      },
    });
    expect(res.statusCode).toBe(204);

    const otherRefresh = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: other.refreshToken },
    });
    expect(otherRefresh.statusCode).toBe(401);

    const currentRefresh = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: current.refreshToken },
    });
    expect(currentRefresh.statusCode).toBe(200);

    expect((await login(app, signupBody.email, 'a brand new password')).statusCode).toBe(200);
    expect((await login(app, signupBody.email, signupBody.password)).statusCode).toBe(401);
  });

  it('change-password: 401 INVALID_CREDENTIALS for a wrong current password', async () => {
    const app = await build({ authRateLimitMax: 100 });
    await signup(app);
    const { accessToken } = (await login(app)).json();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-password',
      headers: { authorization: `Bearer ${accessToken as string}` },
      payload: { currentPassword: 'wrong', newPassword: 'a brand new password' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('change-password: 400 for a new password that breaks the policy', async () => {
    const app = await build({ authRateLimitMax: 100 });
    await signup(app);
    const { accessToken } = (await login(app)).json();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-password',
      headers: { authorization: `Bearer ${accessToken as string}` },
      payload: { currentPassword: signupBody.password, newPassword: 'short' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});
