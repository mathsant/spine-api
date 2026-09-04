import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { signAccessToken } from '../../../src/auth';
import { buildApp } from '../../../src/app';
import type { AppConfig } from '../../../src/config';
import { MongoUserRepository } from '../../../src/repositories/users';
import { ensureAuthIndexes } from '../../helpers/auth-indexes';
import { ensureBookIndexes } from '../../helpers/book-indexes';
import { ensureReviewIndexes } from '../../helpers/review-indexes';
import { testConfig } from '../../helpers/config';
import { type MongoMemory, startMongoMemory } from '../../helpers/mongo-memory';
import { type OpenLibraryStub, startOpenLibraryStub } from '../../helpers/open-library-stub';

const DB_NAME = 'reviews_routes_test';
const SECRET = testConfig().accessTokenSecret;
const STUB_DOC = {
  key: '/works/OL_STUB_W',
  title: 'Stub Book',
  author_name: ['Stub Author'],
};

describe('reviews routes (integration)', () => {
  let mongo: MongoMemory;
  let openLibrary: OpenLibraryStub;
  let apps: FastifyInstance[] = [];
  let auth: string;
  let otherAuth: string;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    const db = mongo.client.db(DB_NAME);
    await ensureAuthIndexes(db);
    await ensureBookIndexes(db);
    await ensureReviewIndexes(db);

    const users = new MongoUserRepository(db);
    const user = await users.create({
      email: 'reader@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'reader',
      displayName: 'Reader',
    });
    const other = await users.create({
      email: 'other@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'other',
      displayName: 'Other',
    });
    auth = `Bearer ${signAccessToken({ userId: user.id }, SECRET)}`;
    otherAuth = `Bearer ${signAccessToken({ userId: other.id }, SECRET)}`;

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
      ['books', 'shelf_memberships', 'reading_sessions', 'reviews'].map((c) =>
        db.collection(c).deleteMany({}),
      ),
    );
  });

  afterEach(async () => {
    await Promise.all(apps.map((a) => a.close()));
    apps = [];
  });

  async function build(overrides: Partial<AppConfig> = {}): Promise<FastifyInstance> {
    const app = await buildApp(
      testConfig({
        mongoUri: mongo.uri,
        mongoDbName: DB_NAME,
        openLibraryBaseUrl: openLibrary.baseUrl,
        ...overrides,
      }),
    );
    apps.push(app);
    return app;
  }

  async function markFinished(app: FastifyInstance, finishedAt = '2025-01-01T00:00:00.000Z') {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/books/OL_STUB_W/mark-finished',
      headers: { authorization: auth },
      payload: { finishedAt },
    });
    return res.json().id as string;
  }

  async function startReading(app: FastifyInstance) {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/books/OL_STUB_W/start-reading',
      headers: { authorization: auth },
    });
    return res.json().id as string;
  }

  // ---- create ---------------------------------------------------------

  it('creates a review for a finished session (201) with all fields (cenário 1/3)', async () => {
    const app = await build();
    const sessionId = await markFinished(app);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/review`,
      headers: { authorization: auth },
      payload: { rating: 4, text: 'Great, with a light spoiler', containsSpoiler: true },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      sessionId,
      rating: 4,
      text: 'Great, with a light spoiler',
      containsSpoiler: true,
    });
  });

  it('defaults text to null and containsSpoiler to false when omitted (cenário 2)', async () => {
    const app = await build();
    const sessionId = await markFinished(app);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/review`,
      headers: { authorization: auth },
      payload: { rating: 3 },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ rating: 3, text: null, containsSpoiler: false });
  });

  it('rejects rating outside 1-5 with 400 VALIDATION_ERROR', async () => {
    const app = await build();
    const sessionId = await markFinished(app);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/review`,
      headers: { authorization: auth },
      payload: { rating: 6 },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a session still reading with 409 READING_SESSION_NOT_FINISHED (cenário 4)', async () => {
    const app = await build();
    const sessionId = await startReading(app);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/review`,
      headers: { authorization: auth },
      payload: { rating: 3 },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('READING_SESSION_NOT_FINISHED');
  });

  it('rejects a second review on the same session with 409 REVIEW_ALREADY_EXISTS (cenário 5)', async () => {
    const app = await build();
    const sessionId = await markFinished(app);

    await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/review`,
      headers: { authorization: auth },
      payload: { rating: 4 },
    });
    const second = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/review`,
      headers: { authorization: auth },
      payload: { rating: 5 },
    });

    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('REVIEW_ALREADY_EXISTS');
  });

  it('reports a nonexistent or third-party session as 404, not 403 (cenário 11, D7/D9)', async () => {
    const app = await build();
    const sessionId = await markFinished(app);

    const ghost = await app.inject({
      method: 'POST',
      url: '/v1/reading-sessions/000000000000000000000000/review',
      headers: { authorization: auth },
      payload: { rating: 3 },
    });
    expect(ghost.statusCode).toBe(404);
    expect(ghost.json().error.code).toBe('READING_SESSION_NOT_FOUND');

    const thirdParty = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/review`,
      headers: { authorization: otherAuth },
      payload: { rating: 3 },
    });
    expect(thirdParty.statusCode).toBe(404);
    expect(thirdParty.json().error.code).toBe('READING_SESSION_NOT_FOUND');
  });

  // ---- edit -------------------------------------------------------------

  it('edits only the patched field (cenário 6)', async () => {
    const app = await build();
    const sessionId = await markFinished(app);
    const created = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/review`,
      headers: { authorization: auth },
      payload: { rating: 4, text: 'Original', containsSpoiler: false },
    });
    const reviewId = created.json().id as string;

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/reviews/${reviewId}`,
      headers: { authorization: auth },
      payload: { rating: 5 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ rating: 5, text: 'Original', containsSpoiler: false });
  });

  it('clears text via null (cenário 7)', async () => {
    const app = await build();
    const sessionId = await markFinished(app);
    const created = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/review`,
      headers: { authorization: auth },
      payload: { rating: 4, text: 'Original' },
    });
    const reviewId = created.json().id as string;

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/reviews/${reviewId}`,
      headers: { authorization: auth },
      payload: { text: null },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().text).toBeNull();
  });

  it('rejects an edit with no fields (400)', async () => {
    const app = await build();
    const sessionId = await markFinished(app);
    const created = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/review`,
      headers: { authorization: auth },
      payload: { rating: 4 },
    });
    const reviewId = created.json().id as string;

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/reviews/${reviewId}`,
      headers: { authorization: auth },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it('reports a nonexistent or third-party review as 404 on edit (cenário 12, D7/D9)', async () => {
    const app = await build();
    const sessionId = await markFinished(app);
    const created = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/review`,
      headers: { authorization: auth },
      payload: { rating: 4 },
    });
    const reviewId = created.json().id as string;

    const ghost = await app.inject({
      method: 'PATCH',
      url: '/v1/reviews/000000000000000000000000',
      headers: { authorization: auth },
      payload: { rating: 1 },
    });
    expect(ghost.statusCode).toBe(404);
    expect(ghost.json().error.code).toBe('REVIEW_NOT_FOUND');

    const thirdParty = await app.inject({
      method: 'PATCH',
      url: `/v1/reviews/${reviewId}`,
      headers: { authorization: otherAuth },
      payload: { rating: 1 },
    });
    expect(thirdParty.statusCode).toBe(404);
    expect(thirdParty.json().error.code).toBe('REVIEW_NOT_FOUND');
  });

  // ---- delete + aggregates + cascade + embedding -------------------------

  it('deletes a review (204) and the book aggregates drop back to null/0 (cenário 8, 10)', async () => {
    const app = await build();
    const sessionId = await markFinished(app);
    const created = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/review`,
      headers: { authorization: auth },
      payload: { rating: 5 },
    });
    const reviewId = created.json().id as string;

    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/reviews/${reviewId}`,
      headers: { authorization: auth },
    });
    expect(del.statusCode).toBe(204);

    const after = await app.inject({
      method: 'PATCH',
      url: `/v1/reviews/${reviewId}`,
      headers: { authorization: auth },
      payload: { rating: 1 },
    });
    expect(after.statusCode).toBe(404);

    const book = await app.inject({
      method: 'GET',
      url: '/v1/books/OL_STUB_W',
      headers: { authorization: auth },
    });
    expect(book.json().aggregates).toEqual({ averageRating: null, reviewCount: 0, readerCount: 1 });
  });

  it('reflects real aggregates on the book detail (cenário 9)', async () => {
    const app = await build();
    const sessionId = await markFinished(app);
    await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/review`,
      headers: { authorization: auth },
      payload: { rating: 4 },
    });

    const book = await app.inject({
      method: 'GET',
      url: '/v1/books/OL_STUB_W',
      headers: { authorization: auth },
    });
    expect(book.json().aggregates).toMatchObject({ averageRating: 4, reviewCount: 1 });
  });

  it('cascades review deletion when the reading session is deleted (cenário 8)', async () => {
    const app = await build();
    const sessionId = await markFinished(app);
    const created = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/review`,
      headers: { authorization: auth },
      payload: { rating: 4 },
    });
    const reviewId = created.json().id as string;

    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/reading-sessions/${sessionId}`,
      headers: { authorization: auth },
    });
    expect(del.statusCode).toBe(204);

    const after = await app.inject({
      method: 'PATCH',
      url: `/v1/reviews/${reviewId}`,
      headers: { authorization: auth },
      payload: { rating: 1 },
    });
    expect(after.statusCode).toBe(404);
    expect(after.json().error.code).toBe('REVIEW_NOT_FOUND');
  });

  it('embeds the review in the reading-sessions history, null when absent (cenário 13/14)', async () => {
    const app = await build();
    const reviewedSessionId = await markFinished(app, '2024-01-01T00:00:00.000Z');
    const unreviewedSessionId = await markFinished(app, '2025-01-01T00:00:00.000Z');
    await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${reviewedSessionId}/review`,
      headers: { authorization: auth },
      payload: { rating: 4 },
    });

    const history = await app.inject({
      method: 'GET',
      url: '/v1/me/reading-sessions',
      headers: { authorization: auth },
    });

    const items = history.json().items as Array<{ id: string; review: unknown }>;
    const reviewed = items.find((item) => item.id === reviewedSessionId);
    const unreviewed = items.find((item) => item.id === unreviewedSessionId);
    expect(reviewed?.review).toMatchObject({ rating: 4 });
    expect(unreviewed?.review).toBeNull();
  });

  it('reports a nonexistent or third-party review as 404 on delete (D7/D9)', async () => {
    const app = await build();
    const sessionId = await markFinished(app);
    const created = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/review`,
      headers: { authorization: auth },
      payload: { rating: 4 },
    });
    const reviewId = created.json().id as string;

    const ghost = await app.inject({
      method: 'DELETE',
      url: '/v1/reviews/000000000000000000000000',
      headers: { authorization: auth },
    });
    expect(ghost.statusCode).toBe(404);

    const thirdParty = await app.inject({
      method: 'DELETE',
      url: `/v1/reviews/${reviewId}`,
      headers: { authorization: otherAuth },
    });
    expect(thirdParty.statusCode).toBe(404);
  });
});
