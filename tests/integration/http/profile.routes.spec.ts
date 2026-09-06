import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { signAccessToken } from '../../../src/auth';
import { buildApp } from '../../../src/app';
import { MongoUserRepository } from '../../../src/repositories/users';
import { ensureAuthIndexes } from '../../helpers/auth-indexes';
import { testConfig } from '../../helpers/config';
import { type MongoMemory, startMongoMemory } from '../../helpers/mongo-memory';

const DB_NAME = 'profile_routes_test';
const SECRET = testConfig().accessTokenSecret;

describe('profile routes (integration)', () => {
  let mongo: MongoMemory;
  let apps: FastifyInstance[] = [];
  let auth: string;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    const db = mongo.client.db(DB_NAME);
    await ensureAuthIndexes(db);

    const user = await new MongoUserRepository(db).create({
      email: 'alice@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'alice',
      displayName: 'Alice',
    });
    auth = `Bearer ${signAccessToken({ userId: user.id }, SECRET)}`;
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    const db = mongo.client.db(DB_NAME);
    await db
      .collection('users')
      .updateOne({ handle: 'alice' }, { $set: { displayName: 'Alice', bio: null } });
  });

  afterEach(async () => {
    await Promise.all(apps.map((a) => a.close()));
    apps = [];
  });

  async function build(): Promise<FastifyInstance> {
    const app = await buildApp(testConfig({ mongoUri: mongo.uri, mongoDbName: DB_NAME }));
    apps.push(app);
    return app;
  }

  // ---- GET /v1/me (cenário 1) ----------------------------------------------

  it('GET /v1/me: 200 and includes bio (null by default)', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: auth } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ handle: 'alice', displayName: 'Alice', bio: null });
  });

  it('GET /v1/me: 401 without Authorization', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/v1/me' });
    expect(res.statusCode).toBe(401);
  });

  // ---- PATCH /v1/me (cenário 2) --------------------------------------------

  it('PATCH /v1/me: 200 updates displayName and bio', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me',
      headers: { authorization: auth },
      payload: { displayName: 'Alice Reader', bio: 'Reading sci-fi' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      handle: 'alice',
      displayName: 'Alice Reader',
      bio: 'Reading sci-fi',
    });

    const getRes = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: auth } });
    expect(getRes.json()).toMatchObject({ displayName: 'Alice Reader', bio: 'Reading sci-fi' });
  });

  it('PATCH /v1/me: 400 when the body carries a handle field', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me',
      headers: { authorization: auth },
      payload: { handle: 'new-handle' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('PATCH /v1/me: 400 when displayName is empty', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me',
      headers: { authorization: auth },
      payload: { displayName: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('PATCH /v1/me: 401 without Authorization', async () => {
    const app = await build();
    const res = await app.inject({ method: 'PATCH', url: '/v1/me', payload: { displayName: 'X' } });
    expect(res.statusCode).toBe(401);
  });

  // ---- GET /v1/me/stats (D3) ---------------------------------------------

  it('GET /v1/me/stats: 200 with the five integer counters', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/me/stats',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      booksRead: 0,
      followers: 0,
      following: 0,
      pendingFollowRequests: 0,
      wantToRead: 0,
    });
  });

  it('GET /v1/me/stats: 401 without Authorization', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/v1/me/stats' });
    expect(res.statusCode).toBe(401);
  });
});
