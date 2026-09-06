import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { signAccessToken } from '../../../src/auth';
import { buildApp } from '../../../src/app';
import { MongoActivityRepository } from '../../../src/repositories/activities';
import { MongoBookRepository } from '../../../src/repositories/books';
import { MongoFollowRepository } from '../../../src/repositories/follows';
import { MongoUserRepository } from '../../../src/repositories/users';
import { ensureAuthIndexes } from '../../helpers/auth-indexes';
import { ensureBookIndexes } from '../../helpers/book-indexes';
import { ensureFollowIndexes } from '../../helpers/follow-indexes';
import { testConfig } from '../../helpers/config';
import { aSearchResult } from '../../helpers/fake-open-library-client';
import { type MongoMemory, startMongoMemory } from '../../helpers/mongo-memory';

const DB_NAME = 'users_routes_test';
const SECRET = testConfig().accessTokenSecret;

describe('users routes (integration)', () => {
  let mongo: MongoMemory;
  let apps: FastifyInstance[] = [];
  let auth: string;
  let aliceId: string;
  let bobId: string;
  let daveId: string;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    const db = mongo.client.db(DB_NAME);
    await ensureAuthIndexes(db);
    await ensureBookIndexes(db);
    await ensureFollowIndexes(db);

    const users = new MongoUserRepository(db);
    const alice = await users.create({
      email: 'alice@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'alice',
      displayName: 'Alice',
    });
    aliceId = alice.id;
    auth = `Bearer ${signAccessToken({ userId: alice.id }, SECRET)}`;

    const bob = await users.create({
      email: 'bob@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'bob',
      displayName: 'Bob',
    });
    bobId = bob.id;
    await users.updateProfile(bob.id, { bio: "Bob's private bio" }, new Date());

    // alice approve-follows bob; bob has one activity item
    const follows = new MongoFollowRepository(db);
    await follows.create(alice.id, bob.id, new Date());
    const book = await new MongoBookRepository(db).upsertByOlid(aSearchResult());
    await new MongoActivityRepository(db).record(
      { type: 'started_reading', actorId: bob.id, bookId: book.id, readingSessionId: 's1' },
      new Date('2026-02-01T00:00:00.000Z'),
    );

    // friends-of-friends suggestion graph: alice follows carol too; bob and carol both
    // follow dave, so dave is a suggestion for alice with mutualFollowersCount 2.
    const carol = await users.create({
      email: 'carol@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'carol',
      displayName: 'Carol',
    });
    const dave = await users.create({
      email: 'dave@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'dave',
      displayName: 'Dave',
    });
    daveId = dave.id;
    await follows.create(alice.id, carol.id, new Date());
    await follows.create(bob.id, dave.id, new Date());
    await follows.create(carol.id, dave.id, new Date());
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

  // --- GET /v1/users/search ---

  it('GET /v1/users/search: 200 with avatarUrl null and a relationship on every item', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users/search?q=bob',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      handle: 'bob',
      displayName: 'Bob',
      avatarUrl: null,
      followState: 'following',
      followsYou: false,
    });
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

  it('GET /v1/users/search: 401 without Authorization', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/v1/users/search?q=bob' });
    expect(res.statusCode).toBe(401);
  });

  // --- GET /v1/users/:userId (D1) ---

  it('GET /v1/users/:userId: 200 with bio and followState following for an approved follow', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${bobId}`,
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: bobId,
      handle: 'bob',
      displayName: 'Bob',
      avatarUrl: null,
      bio: "Bob's private bio",
      followState: 'following',
      followsYou: false,
    });
  });

  it('GET /v1/users/:userId: 404 USER_NOT_FOUND with an identical body for a nonexistent and a malformed id', async () => {
    const app = await build();
    const missing = await app.inject({
      method: 'GET',
      url: '/v1/users/507f1f77bcf86cd799439099',
      headers: { authorization: auth },
    });
    const malformed = await app.inject({
      method: 'GET',
      url: '/v1/users/not-an-id',
      headers: { authorization: auth },
    });

    expect(missing.statusCode).toBe(404);
    expect(malformed.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('USER_NOT_FOUND');
    expect(malformed.json()).toEqual(missing.json());
  });

  it('GET /v1/users/:userId: 401 without Authorization', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: `/v1/users/${bobId}` });
    expect(res.statusCode).toBe(401);
  });

  // --- GET /v1/users/:userId/activity (D2) ---

  it('GET /v1/users/:userId/activity: 200 { items, nextCursor } for an approved follower', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${bobId}/activity`,
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ type: 'started_reading', actor: { userId: bobId } });
    expect(body).toHaveProperty('nextCursor');
  });

  it('GET /v1/users/:userId/activity: 404 USER_NOT_FOUND when not following the target', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${aliceId}/activity`,
      headers: { authorization: `Bearer ${signAccessToken({ userId: bobId }, SECRET)}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('USER_NOT_FOUND');
  });

  it('GET /v1/users/:userId/activity: 400 for a limit outside 1..100', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${bobId}/activity?limit=999`,
      headers: { authorization: auth },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /v1/users/:userId/activity: 401 without Authorization', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: `/v1/users/${bobId}/activity` });
    expect(res.statusCode).toBe(401);
  });

  // --- GET /v1/users/suggestions (012) ---

  it('GET /v1/users/suggestions: 200 { items } ranked, avatarUrl null, followState none', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users/suggestions',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeLessThanOrEqual(4);
    const dave = body.items.find((i: { id: string }) => i.id === daveId);
    expect(dave).toMatchObject({
      handle: 'dave',
      avatarUrl: null,
      followState: 'none',
      mutualFollowersCount: 2,
    });
    expect(body.items.some((i: { id: string }) => i.id === aliceId)).toBe(false);
  });

  it('GET /v1/users/suggestions: is not shadowed by /users/:userId', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users/suggestions',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).not.toHaveProperty('error');
  });

  it('GET /v1/users/suggestions: 401 without Authorization', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/v1/users/suggestions' });
    expect(res.statusCode).toBe(401);
  });
});
