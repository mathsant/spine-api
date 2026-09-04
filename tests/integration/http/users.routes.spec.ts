import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { signAccessToken } from '../../../src/auth';
import { buildApp } from '../../../src/app';
import { MongoUserRepository } from '../../../src/repositories/users';
import { ensureAuthIndexes } from '../../helpers/auth-indexes';
import { testConfig } from '../../helpers/config';
import { type MongoMemory, startMongoMemory } from '../../helpers/mongo-memory';

const DB_NAME = 'users_routes_test';
const SECRET = testConfig().accessTokenSecret;

describe('users routes (integration)', () => {
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

    await new MongoUserRepository(db).create({
      email: 'bob@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'bob',
      displayName: 'Bob',
    });
  });

  afterAll(async () => {
    await mongo.stop();
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

  it('GET /v1/users/search: 200 with avatarUrl: null on every item (cenário 3)', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users/search?q=bob',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ handle: 'bob', displayName: 'Bob', avatarUrl: null });
    expect(body.items[0]).not.toHaveProperty('email');
  });

  it('GET /v1/users/search: 400 when q has 1 char', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users/search?q=b',
      headers: { authorization: auth },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /v1/users/search: 400 without q', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users/search',
      headers: { authorization: auth },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /v1/users/search: 401 without Authorization', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/v1/users/search?q=bob' });
    expect(res.statusCode).toBe(401);
  });
});
