import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { signAccessToken } from '../../../src/auth';
import { buildApp } from '../../../src/app';
import type { AppConfig } from '../../../src/config';
import { MongoUserRepository } from '../../../src/repositories/users';
import { ensureAuthIndexes } from '../../helpers/auth-indexes';
import { ensureBookIndexes } from '../../helpers/book-indexes';
import { testConfig } from '../../helpers/config';
import { type MongoMemory, startMongoMemory } from '../../helpers/mongo-memory';
import { type OpenLibraryStub, startOpenLibraryStub } from '../../helpers/open-library-stub';

const DB_NAME = 'reading_sessions_routes_test';
const SECRET = testConfig().accessTokenSecret;
const STUB_DOC = {
  key: '/works/OL_STUB_W',
  title: 'Stub Book',
  author_name: ['Stub Author'],
};

describe('reading-sessions routes (integration)', () => {
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
      ['books', 'shelf_memberships', 'reading_sessions'].map((c) => db.collection(c).deleteMany({})),
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

  async function startReading(app: FastifyInstance): Promise<{ sessionId: string; status: number }> {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/books/OL_STUB_W/start-reading',
      headers: { authorization: auth },
    });
    return { sessionId: res.json().id as string, status: res.statusCode };
  }

  // ---- start-reading -------------------------------------------------------

  it('start-reading: 201 on first call, 200 reusing the open session on the second (RF-009)', async () => {
    const app = await build();

    const first = await startReading(app);
    expect(first.status).toBe(201);

    const second = await startReading(app);
    expect(second.status).toBe(200);
    expect(second.sessionId).toBe(first.sessionId);
  });

  // ---- progress --------------------------------------------------------

  it('progress: 200 while reading, 409 once finished', async () => {
    const app = await build();
    const { sessionId } = await startReading(app);

    const ok = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/progress`,
      headers: { authorization: auth },
      payload: { currentPage: 100 },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().currentPage).toBe(100);

    await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/finish`,
      headers: { authorization: auth },
    });

    const afterFinish = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/progress`,
      headers: { authorization: auth },
      payload: { currentPage: 120 },
    });
    expect(afterFinish.statusCode).toBe(409);
    expect(afterFinish.json().error.code).toBe('INVALID_READING_SESSION_STATE');
  });

  // ---- mark-finished + reread --------------------------------------------

  it('mark-finished: 201, and calling it again creates an independent session (RF-016)', async () => {
    const app = await build();

    const first = await app.inject({
      method: 'POST',
      url: '/v1/books/OL_STUB_W/mark-finished',
      headers: { authorization: auth },
      payload: { finishedAt: '2024-01-01T00:00:00.000Z' },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/v1/books/OL_STUB_W/mark-finished',
      headers: { authorization: auth },
      payload: { finishedAt: '2025-01-01T00:00:00.000Z' },
    });
    expect(second.statusCode).toBe(201);
    expect(second.json().id).not.toBe(first.json().id);
  });

  // ---- finish idempotent --------------------------------------------------

  it('finish: 200, and finishing again just updates finishedAt (idempotent)', async () => {
    const app = await build();
    const { sessionId } = await startReading(app);

    const first = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/finish`,
      headers: { authorization: auth },
      payload: { finishedAt: '2025-01-01T00:00:00.000Z' },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/finish`,
      headers: { authorization: auth },
      payload: { finishedAt: '2025-02-01T00:00:00.000Z' },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().finishedAt).toBe('2025-02-01T00:00:00.000Z');
  });

  // ---- edit ----------------------------------------------------------------

  it('edit: 200 on a valid patch, 422 when finishedAt would precede startedAt', async () => {
    const app = await build();
    const { sessionId } = await startReading(app);

    const ok = await app.inject({
      method: 'PATCH',
      url: `/v1/reading-sessions/${sessionId}`,
      headers: { authorization: auth },
      payload: { currentPage: 42 },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().currentPage).toBe(42);

    const invalid = await app.inject({
      method: 'PATCH',
      url: `/v1/reading-sessions/${sessionId}`,
      headers: { authorization: auth },
      payload: { finishedAt: '2000-01-01T00:00:00.000Z' },
    });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json().error.code).toBe('INVALID_READING_SESSION_DATES');
  });

  // ---- delete + not found --------------------------------------------------

  it('delete: 204, then 404 on any further operation on that session', async () => {
    const app = await build();
    const { sessionId } = await startReading(app);

    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/reading-sessions/${sessionId}`,
      headers: { authorization: auth },
    });
    expect(del.statusCode).toBe(204);

    const after = await app.inject({
      method: 'PATCH',
      url: `/v1/reading-sessions/${sessionId}`,
      headers: { authorization: auth },
      payload: { currentPage: 1 },
    });
    expect(after.statusCode).toBe(404);
    expect(after.json().error.code).toBe('READING_SESSION_NOT_FOUND');
  });

  // ---- ownership (D9) -------------------------------------------------------

  it('a session belonging to another user is 404, not 403, on every mutation', async () => {
    const app = await build();
    const { sessionId } = await startReading(app);

    const progress = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/progress`,
      headers: { authorization: otherAuth },
      payload: { currentPage: 1 },
    });
    expect(progress.statusCode).toBe(404);

    const finish = await app.inject({
      method: 'POST',
      url: `/v1/reading-sessions/${sessionId}/finish`,
      headers: { authorization: otherAuth },
    });
    expect(finish.statusCode).toBe(404);

    const edit = await app.inject({
      method: 'PATCH',
      url: `/v1/reading-sessions/${sessionId}`,
      headers: { authorization: otherAuth },
      payload: { currentPage: 1 },
    });
    expect(edit.statusCode).toBe(404);

    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/reading-sessions/${sessionId}`,
      headers: { authorization: otherAuth },
    });
    expect(del.statusCode).toBe(404);
  });

  // ---- history / bookId filter -----------------------------------------

  it('history: paginated, filterable by bookId, includes rereads', async () => {
    const app = await build();

    await app.inject({
      method: 'POST',
      url: '/v1/books/OL_STUB_W/mark-finished',
      headers: { authorization: auth },
      payload: { finishedAt: '2024-01-01T00:00:00.000Z' },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/books/OL_STUB_W/mark-finished',
      headers: { authorization: auth },
      payload: { finishedAt: '2025-01-01T00:00:00.000Z' },
    });

    const detail = await app.inject({
      method: 'GET',
      url: '/v1/books/OL_STUB_W',
      headers: { authorization: auth },
    });
    const bookId = detail.json().id as string;

    const history = await app.inject({
      method: 'GET',
      url: `/v1/me/reading-sessions?bookId=${bookId}`,
      headers: { authorization: auth },
    });
    expect(history.statusCode).toBe(200);
    expect(history.json().items).toHaveLength(2);

    const limited = await app.inject({
      method: 'GET',
      url: '/v1/me/reading-sessions?limit=1',
      headers: { authorization: auth },
    });
    expect(limited.json().items).toHaveLength(1);
    expect(limited.json().nextCursor).not.toBeNull();
  });
});
