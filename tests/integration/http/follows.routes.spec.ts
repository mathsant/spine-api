import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { signAccessToken } from '../../../src/auth';
import { buildApp } from '../../../src/app';
import { MongoUserRepository } from '../../../src/repositories/users';
import { ensureAuthIndexes } from '../../helpers/auth-indexes';
import { ensureFollowIndexes } from '../../helpers/follow-indexes';
import { testConfig } from '../../helpers/config';
import { type MongoMemory, startMongoMemory } from '../../helpers/mongo-memory';

const DB_NAME = 'follows_routes_test';
const SECRET = testConfig().accessTokenSecret;

describe('follows routes (integration)', () => {
  let mongo: MongoMemory;
  let apps: FastifyInstance[] = [];
  let userIdA: string;
  let userIdB: string;
  let authA: string;
  let authB: string;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    const db = mongo.client.db(DB_NAME);
    await ensureAuthIndexes(db);
    await ensureFollowIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    const db = mongo.client.db(DB_NAME);
    await Promise.all(
      ['users', 'follow_requests', 'follows'].map((c) => db.collection(c).deleteMany({})),
    );

    const userRepository = new MongoUserRepository(db);
    const userA = await userRepository.create({
      email: 'alice@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'alice',
      displayName: 'Alice',
    });
    const userB = await userRepository.create({
      email: 'bob@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'bob',
      displayName: 'Bob',
    });
    userIdA = userA.id;
    userIdB = userB.id;
    authA = `Bearer ${signAccessToken({ userId: userA.id }, SECRET)}`;
    authB = `Bearer ${signAccessToken({ userId: userB.id }, SECRET)}`;
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

  // ---- pedir / cancelar / pedir de novo (cenários 4, 5, 11, 12) ------------

  it('POST .../follow-request: 422 when targeting yourself (cenário 11)', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdA}/follow-request`,
      headers: { authorization: authA },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('CANNOT_FOLLOW_SELF');
  });

  it('POST .../follow-request: 201 new, 200 idempotent for a pending duplicate (cenário 4)', async () => {
    const app = await build();
    const first = await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdB}/follow-request`,
      headers: { authorization: authA },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdB}/follow-request`,
      headers: { authorization: authA },
    });
    expect(second.statusCode).toBe(200);

    const outgoing = await app.inject({
      method: 'GET',
      url: '/v1/me/follow-requests?direction=outgoing',
      headers: { authorization: authA },
    });
    expect(outgoing.json().items).toMatchObject([{ userId: userIdB, direction: 'outgoing' }]);

    const incoming = await app.inject({
      method: 'GET',
      url: '/v1/me/follow-requests?direction=incoming',
      headers: { authorization: authB },
    });
    expect(incoming.json().items).toMatchObject([{ userId: userIdA, direction: 'incoming' }]);
  });

  it('DELETE .../follow-request: cancels a pending request; resending after cancel creates a new one (cenário 5)', async () => {
    const app = await build();
    await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdB}/follow-request`,
      headers: { authorization: authA },
    });

    const cancel = await app.inject({
      method: 'DELETE',
      url: `/v1/users/${userIdB}/follow-request`,
      headers: { authorization: authA },
    });
    expect(cancel.statusCode).toBe(204);

    const cancelAgain = await app.inject({
      method: 'DELETE',
      url: `/v1/users/${userIdB}/follow-request`,
      headers: { authorization: authA },
    });
    expect(cancelAgain.statusCode).toBe(404);

    const resend = await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdB}/follow-request`,
      headers: { authorization: authA },
    });
    expect(resend.statusCode).toBe(201);
  });

  // ---- aprovar (cenário 6) --------------------------------------------------

  it('POST .../approve: creates only requester -> target, no reciprocity (cenário 6, RF-011)', async () => {
    const app = await build();
    await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdB}/follow-request`,
      headers: { authorization: authA },
    });

    const approve = await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdA}/follow-request/approve`,
      headers: { authorization: authB },
    });
    expect(approve.statusCode).toBe(204);

    const bFollowers = await app.inject({
      method: 'GET',
      url: '/v1/me/followers',
      headers: { authorization: authB },
    });
    expect(bFollowers.json().items).toMatchObject([{ userId: userIdA }]);

    const aFollowing = await app.inject({
      method: 'GET',
      url: '/v1/me/following',
      headers: { authorization: authA },
    });
    expect(aFollowing.json().items).toMatchObject([{ userId: userIdB }]);

    const bFollowing = await app.inject({
      method: 'GET',
      url: '/v1/me/following',
      headers: { authorization: authB },
    });
    expect(bFollowing.json().items).toEqual([]);
  });

  // ---- recusar (cenário 7) ---------------------------------------------------

  it('POST .../reject: deletes the request; resending after reject creates a new one (cenário 7)', async () => {
    const app = await build();
    await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdB}/follow-request`,
      headers: { authorization: authA },
    });

    const reject = await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdA}/follow-request/reject`,
      headers: { authorization: authB },
    });
    expect(reject.statusCode).toBe(204);

    const rejectAgain = await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdA}/follow-request/reject`,
      headers: { authorization: authB },
    });
    expect(rejectAgain.statusCode).toBe(404);

    const resend = await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdB}/follow-request`,
      headers: { authorization: authA },
    });
    expect(resend.statusCode).toBe(201);
  });

  // ---- duplicado já seguindo (cenário 12) ------------------------------------

  it('POST .../follow-request: 409 when the requester already follows the target (cenário 12)', async () => {
    const app = await build();
    await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdB}/follow-request`,
      headers: { authorization: authA },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdA}/follow-request/approve`,
      headers: { authorization: authB },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdB}/follow-request`,
      headers: { authorization: authA },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('ALREADY_FOLLOWING');
  });

  // ---- desfazer a relação (cenários 8, 9) ------------------------------------

  it('DELETE .../follow: unfollows; a second attempt 404s (cenário 8)', async () => {
    const app = await build();
    await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdB}/follow-request`,
      headers: { authorization: authA },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdA}/follow-request/approve`,
      headers: { authorization: authB },
    });

    const unfollow = await app.inject({
      method: 'DELETE',
      url: `/v1/users/${userIdB}/follow`,
      headers: { authorization: authA },
    });
    expect(unfollow.statusCode).toBe(204);

    const again = await app.inject({
      method: 'DELETE',
      url: `/v1/users/${userIdB}/follow`,
      headers: { authorization: authA },
    });
    expect(again.statusCode).toBe(404);
  });

  it('DELETE .../follower: removes a follower; a second attempt 404s (cenário 9)', async () => {
    const app = await build();
    await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdB}/follow-request`,
      headers: { authorization: authA },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdA}/follow-request/approve`,
      headers: { authorization: authB },
    });

    const remove = await app.inject({
      method: 'DELETE',
      url: `/v1/users/${userIdA}/follower`,
      headers: { authorization: authB },
    });
    expect(remove.statusCode).toBe(204);

    const again = await app.inject({
      method: 'DELETE',
      url: `/v1/users/${userIdA}/follower`,
      headers: { authorization: authB },
    });
    expect(again.statusCode).toBe(404);
  });

  // ---- privacidade das listas (cenário 10, RF-020) ---------------------------

  it('GET /me/follow-requests, /me/followers, /me/following only ever return the caller\'s own data (cenário 10, RF-020)', async () => {
    const app = await build();
    await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdB}/follow-request`,
      headers: { authorization: authA },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdA}/follow-request/approve`,
      headers: { authorization: authB },
    });

    const aFollowers = await app.inject({
      method: 'GET',
      url: '/v1/me/followers',
      headers: { authorization: authA },
    });
    expect(aFollowers.json().items).toEqual([]);

    const bFollowRequestsOutgoing = await app.inject({
      method: 'GET',
      url: '/v1/me/follow-requests?direction=outgoing',
      headers: { authorization: authB },
    });
    expect(bFollowRequestsOutgoing.json().items).toEqual([]);
  });

  it('every follows endpoint: 401 without Authorization', async () => {
    const app = await build();
    const routes: Array<[string, string]> = [
      ['POST', `/v1/users/${userIdB}/follow-request`],
      ['DELETE', `/v1/users/${userIdB}/follow-request`],
      ['POST', `/v1/users/${userIdB}/follow-request/approve`],
      ['POST', `/v1/users/${userIdB}/follow-request/reject`],
      ['DELETE', `/v1/users/${userIdB}/follow`],
      ['DELETE', `/v1/users/${userIdB}/follower`],
      ['GET', '/v1/me/follow-requests'],
      ['GET', '/v1/me/followers'],
      ['GET', '/v1/me/following'],
    ];

    for (const [method, url] of routes) {
      const res = await app.inject({ method: method as 'GET', url });
      expect(res.statusCode).toBe(401);
    }
  });
});
