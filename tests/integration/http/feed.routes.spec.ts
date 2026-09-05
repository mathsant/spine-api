import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { signAccessToken } from '../../../src/auth';
import { buildApp } from '../../../src/app';
import type { AppConfig } from '../../../src/config';
import { MongoUserRepository } from '../../../src/repositories/users';
import { ensureAuthIndexes } from '../../helpers/auth-indexes';
import { ensureBookIndexes } from '../../helpers/book-indexes';
import { ensureFollowIndexes } from '../../helpers/follow-indexes';
import { ensureReviewIndexes } from '../../helpers/review-indexes';
import { testConfig } from '../../helpers/config';
import { type MongoMemory, startMongoMemory } from '../../helpers/mongo-memory';
import { type OpenLibraryStub, startOpenLibraryStub } from '../../helpers/open-library-stub';

const DB_NAME = 'feed_routes_test';
const SECRET = testConfig().accessTokenSecret;
const STUB_DOC = {
  key: '/works/OL_STUB_W',
  title: 'Stub Book',
  author_name: ['Stub Author'],
};

describe('feed routes (integration)', () => {
  let mongo: MongoMemory;
  let openLibrary: OpenLibraryStub;
  let apps: FastifyInstance[] = [];
  let userIdA: string;
  let userIdB: string;
  let userIdC: string;
  let authA: string;
  let authB: string;
  let authC: string;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    const db = mongo.client.db(DB_NAME);
    await ensureAuthIndexes(db);
    await ensureBookIndexes(db);
    await ensureFollowIndexes(db);
    await ensureReviewIndexes(db);

    openLibrary = await startOpenLibraryStub([STUB_DOC]);
  });

  afterAll(async () => {
    await mongo.stop();
    await openLibrary.close();
  });

  beforeEach(async () => {
    openLibrary.setDocs([STUB_DOC]);
    const db = mongo.client.db(DB_NAME);
    await Promise.all(
      [
        'users',
        'books',
        'shelf_memberships',
        'reading_sessions',
        'reviews',
        'activities',
        'follows',
        'follow_requests',
        'reactions',
      ].map((c) => db.collection(c).deleteMany({})),
    );

    const users = new MongoUserRepository(db);
    const userA = await users.create({
      email: 'a@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'usera',
      displayName: 'A',
    });
    const userB = await users.create({
      email: 'b@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'userb',
      displayName: 'B',
    });
    const userC = await users.create({
      email: 'c@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'userc',
      displayName: 'C',
    });
    userIdA = userA.id;
    userIdB = userB.id;
    userIdC = userC.id;
    authA = `Bearer ${signAccessToken({ userId: userA.id }, SECRET)}`;
    authB = `Bearer ${signAccessToken({ userId: userB.id }, SECRET)}`;
    authC = `Bearer ${signAccessToken({ userId: userC.id }, SECRET)}`;
  });

  afterEach(async () => {
    await Promise.all(apps.map((a) => a.close()));
    apps = [];
  });

  async function build(overrides: Partial<AppConfig> = {}): Promise<FastifyInstance> {
    const app = await buildApp(
      testConfig({ mongoUri: mongo.uri, mongoDbName: DB_NAME, openLibraryBaseUrl: openLibrary.baseUrl, ...overrides }),
    );
    apps.push(app);
    return app;
  }

  /** A follows target, with approval — mirrors the flow already covered by follows.routes.spec.ts (004). */
  async function followApproved(app: FastifyInstance, followerAuth: string, followerId: string, targetAuth: string): Promise<void> {
    await app.inject({
      method: 'POST',
      url: `/v1/users/${userIdOf(targetAuth)}/follow-request`,
      headers: { authorization: followerAuth },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/users/${followerId}/follow-request/approve`,
      headers: { authorization: targetAuth },
    });
  }

  function userIdOf(auth: string): string {
    if (auth === authA) return userIdA;
    if (auth === authB) return userIdB;
    return userIdC;
  }

  async function startReading(app: FastifyInstance, auth: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/books/OL_STUB_W/start-reading',
      headers: { authorization: auth },
    });
    return res.json().id as string;
  }

  it('mixes own activity with followed users\', newest first, and excludes a non-followed one (scenarios 1, 2, 13, RF-006, RF-007, RF-008)', async () => {
    const app = await build();
    await followApproved(app, authA, userIdA, authB);

    await startReading(app, authB); // B starts reading
    await new Promise((resolve) => setTimeout(resolve, 5));
    await startReading(app, authA); // A starts reading (own activity)
    await startReading(app, authC); // C is not followed by A

    const res = await app.inject({ method: 'GET', url: '/v1/feed', headers: { authorization: authA } });
    expect(res.statusCode).toBe(200);
    const items = res.json().items as Array<{ actor: { userId: string } }>;
    expect(items).toHaveLength(2);
    expect(items[0].actor.userId).toBe(userIdA);
    expect(items[1].actor.userId).toBe(userIdB);
  });

  it('a review edited afterwards shows the current content in the feed (scenario 9, RF-009)', async () => {
    const app = await build();
    const sessionId = await startReading(app, authA);
    await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/finish`,
      headers: { authorization: authA },
    });
    const created = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/review`,
      headers: { authorization: authA },
      payload: { rating: 3, text: 'Meh' },
    });
    const reviewId = created.json().id as string;

    await app.inject({
      method: 'PATCH',
      url: `/v1/reviews/${reviewId}`,
      headers: { authorization: authA },
      payload: { rating: 5, text: 'Great after all' },
    });

    const res = await app.inject({ method: 'GET', url: '/v1/feed', headers: { authorization: authA } });
    const reviewItem = (res.json().items as Array<{ type: string; review: { rating: number; text: string } }>).find(
      (item) => item.type === 'review_published',
    );
    expect(reviewItem?.review).toMatchObject({ rating: 5, text: 'Great after all' });
  });

  it('deleting the whole session removes every event; deleting only the review keeps the rest (scenario 10, D4)', async () => {
    const app = await build();
    const sessionId = await startReading(app, authA);
    await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/finish`,
      headers: { authorization: authA },
    });
    const created = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/review`,
      headers: { authorization: authA },
      payload: { rating: 4 },
    });
    const reviewId = created.json().id as string;

    await app.inject({
      method: 'DELETE',
      url: `/v1/reviews/${reviewId}`,
      headers: { authorization: authA },
    });

    const afterReviewDelete = await app.inject({ method: 'GET', url: '/v1/feed', headers: { authorization: authA } });
    const typesAfterReviewDelete = (afterReviewDelete.json().items as Array<{ type: string }>).map((i) => i.type);
    expect(typesAfterReviewDelete).toContain('started_reading');
    expect(typesAfterReviewDelete).not.toContain('review_published');

    await app.inject({
      method: 'DELETE',
      url: `/v1/reading-sessions/${sessionId}`,
      headers: { authorization: authA },
    });

    const afterSessionDelete = await app.inject({ method: 'GET', url: '/v1/feed', headers: { authorization: authA } });
    expect(afterSessionDelete.json().items).toEqual([]);
  });

  it('exposes reactionsCount/hasReacted per item, reflecting a reaction from a follower (007, RF-004)', async () => {
    const app = await build();
    await followApproved(app, authA, userIdA, authB);
    const sessionId = await startReading(app, authB);
    await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/progress`,
      headers: { authorization: authB },
      payload: { currentPage: 10 },
    });

    const before = await app.inject({ method: 'GET', url: '/v1/feed', headers: { authorization: authA } });
    const items = before.json().items as Array<{ id: string; type: string; reactionsCount: number; hasReacted: boolean }>;
    const progressItem = items.find((item) => item.type === 'progress_update');
    expect(progressItem).toMatchObject({ reactionsCount: 0, hasReacted: false });

    const reacted = await app.inject({
      method: 'POST',
      url: `/v1/activities/${progressItem?.id}/reactions`,
      headers: { authorization: authA },
    });
    expect(reacted.statusCode).toBe(204);

    const after = await app.inject({ method: 'GET', url: '/v1/feed', headers: { authorization: authA } });
    const afterItem = (after.json().items as Array<{ type: string; reactionsCount: number; hasReacted: boolean }>).find(
      (item) => item.type === 'progress_update',
    );
    expect(afterItem).toMatchObject({ reactionsCount: 1, hasReacted: true });
  });

  it('GET /feed: 400 VALIDATION_ERROR on a malformed cursor', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/feed?cursor=not-base64url-json',
      headers: { authorization: authA },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /feed: 401 without Authorization', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/v1/feed' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /feed: empty list, not an error, when following nobody with no activity (RF-013)', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/v1/feed', headers: { authorization: authA } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [], nextCursor: null });
  });

  it('paginates by cursor without duplicating or skipping items (scenario 11, RF-011)', async () => {
    const app = await build();
    const sessionId = await startReading(app, authA);
    await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/progress`,
      headers: { authorization: authA },
      payload: { currentPage: 10 },
    });

    const firstPage = await app.inject({
      method: 'GET',
      url: '/v1/feed?limit=1',
      headers: { authorization: authA },
    });
    expect(firstPage.json().items).toHaveLength(1);
    const nextCursor = firstPage.json().nextCursor as string;
    expect(nextCursor).not.toBeNull();

    await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/finish`,
      headers: { authorization: authA },
    });

    const secondPage = await app.inject({
      method: 'GET',
      url: `/v1/feed?limit=1&cursor=${encodeURIComponent(nextCursor)}`,
      headers: { authorization: authA },
    });
    expect(secondPage.json().items).toHaveLength(1);
    expect(secondPage.json().items[0].type).toBe('started_reading');
    expect(secondPage.json().nextCursor).toBeNull();
  });
});
