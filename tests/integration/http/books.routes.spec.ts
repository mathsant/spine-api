import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { signAccessToken } from '../../../src/auth';
import { buildApp } from '../../../src/app';
import type { AppConfig } from '../../../src/config';
import { MongoBookRepository } from '../../../src/repositories/books';
import { MongoFollowRepository } from '../../../src/repositories/follows';
import { MongoReadingSessionRepository } from '../../../src/repositories/reading-sessions';
import { MongoReviewRepository } from '../../../src/repositories/reviews';
import { MongoUserRepository } from '../../../src/repositories/users';
import { ensureAuthIndexes } from '../../helpers/auth-indexes';
import { ensureBookIndexes } from '../../helpers/book-indexes';
import { ensureFollowIndexes } from '../../helpers/follow-indexes';
import { ensureReviewIndexes } from '../../helpers/review-indexes';
import { testConfig } from '../../helpers/config';
import { type MongoMemory, startMongoMemory } from '../../helpers/mongo-memory';
import { type OpenLibraryStub, startOpenLibraryStub } from '../../helpers/open-library-stub';

const DB_NAME = 'books_routes_test';
const SECRET = testConfig().accessTokenSecret;
const STUB_DOC = {
  key: '/works/OL_STUB_W',
  title: 'Stub Book',
  author_name: ['Stub Author'],
  cover_i: 1,
  first_publish_year: 2000,
  isbn: ['9780000000001'],
};

describe('books routes (integration)', () => {
  let mongo: MongoMemory;
  let openLibrary: OpenLibraryStub;
  let apps: FastifyInstance[] = [];
  let auth: string;
  let readerId: string;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    const db = mongo.client.db(DB_NAME);
    await ensureAuthIndexes(db);
    await ensureBookIndexes(db);
    await ensureFollowIndexes(db);
    await ensureReviewIndexes(db);

    const user = await new MongoUserRepository(db).create({
      email: 'reader@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'reader',
      displayName: 'Reader',
    });
    readerId = user.id;
    auth = `Bearer ${signAccessToken({ userId: user.id }, SECRET)}`;

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
      ['books', 'shelf_memberships', 'reading_sessions', 'follows', 'reviews'].map((c) =>
        db.collection(c).deleteMany({}),
      ),
    );
    await db.collection('users').deleteMany({ handle: { $ne: 'reader' } });
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

  async function seedBook(app: FastifyInstance): Promise<string> {
    const search = await app.inject({
      method: 'GET',
      url: '/v1/books/search?q=stub',
      headers: { authorization: auth },
    });
    return (search.json().items[0] as { olid: string }).olid;
  }

  // ---- search --------------------------------------------------------------

  it('search: 200 with paginated results', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/books/search?q=stub',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ page: 1, limit: 20 });
    expect(body.items[0]).toMatchObject({ olid: 'OL_STUB_W', title: 'Stub Book' });
  });

  it('search: 400 when q is missing', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/books/search',
      headers: { authorization: auth },
    });
    expect(res.statusCode).toBe(400);
  });

  it('search: 401 without a bearer token', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/v1/books/search?q=stub' });
    expect(res.statusCode).toBe(401);
  });

  it('search: 503 when Open Library is unreachable', async () => {
    const app = await build({ openLibraryBaseUrl: 'http://127.0.0.1:1', openLibraryTimeoutMs: 200 });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/books/search?q=stub',
      headers: { authorization: auth },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('OPEN_LIBRARY_UNAVAILABLE');
  });

  // ---- detail / cache-on-read ------------------------------------------

  it('detail: 200 caches the book on first interaction', async () => {
    const app = await build();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/books/OL_STUB_W',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      olid: 'OL_STUB_W',
      aggregates: { averageRating: null, reviewCount: 0, readerCount: 0 },
    });
  });

  it('detail: 404 for an unknown olid', async () => {
    openLibrary.setDocs([]);
    const app = await build();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/books/OL_DOES_NOT_EXIST_W',
      headers: { authorization: auth },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('BOOK_NOT_FOUND');
  });

  // ---- want-to-read -------------------------------------------------------

  it('want-to-read: mark then list then unmark, all idempotent (RF-005, RF-006, RF-007)', async () => {
    const app = await build();
    const olid = await seedBook(app);

    const markUrl = `/v1/books/${olid}/want-to-read`;
    const markOnce = await app.inject({ method: 'PUT', url: markUrl, headers: { authorization: auth } });
    const markTwice = await app.inject({ method: 'PUT', url: markUrl, headers: { authorization: auth } });
    expect(markOnce.statusCode).toBe(204);
    expect(markTwice.statusCode).toBe(204);

    const list = await app.inject({
      method: 'GET',
      url: '/v1/me/want-to-read',
      headers: { authorization: auth },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(1);
    expect(list.json().items[0].olid).toBe(olid);

    const unmarkOnce = await app.inject({ method: 'DELETE', url: markUrl, headers: { authorization: auth } });
    const unmarkTwice = await app.inject({ method: 'DELETE', url: markUrl, headers: { authorization: auth } });
    expect(unmarkOnce.statusCode).toBe(204);
    expect(unmarkTwice.statusCode).toBe(204);

    const listAfter = await app.inject({
      method: 'GET',
      url: '/v1/me/want-to-read',
      headers: { authorization: auth },
    });
    expect(listAfter.json().items).toHaveLength(0);
  });

  it('want-to-read: unmarking a book that was never cached is still 204', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/books/OL_NEVER_SEEN_W/want-to-read',
      headers: { authorization: auth },
    });
    expect(res.statusCode).toBe(204);
  });

  it('start-reading removes the book from want_to_read (RF-010)', async () => {
    const app = await build();
    const olid = await seedBook(app);

    await app.inject({
      method: 'PUT',
      url: `/v1/books/${olid}/want-to-read`,
      headers: { authorization: auth },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/books/${olid}/start-reading`,
      headers: { authorization: auth },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/v1/me/want-to-read',
      headers: { authorization: auth },
    });
    expect(list.json().items).toHaveLength(0);
  });

  // ---- book reviews by following ----------------------------------------

  it('reviews: 200 with the review of a followed user, author block carries avatarUrl: null', async () => {
    const db = mongo.client.db(DB_NAME);
    const userRepo = new MongoUserRepository(db);
    const bookRepo = new MongoBookRepository(db);
    const followRepo = new MongoFollowRepository(db);
    const sessionRepo = new MongoReadingSessionRepository(db);
    const reviewRepo = new MongoReviewRepository(db);

    const ana = await userRepo.create({
      email: 'ana@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'ana',
      displayName: 'Ana',
    });
    const book = await bookRepo.upsertByOlid({
      olid: 'OL_STUB_W',
      isbn13: null,
      title: 'Stub Book',
      authors: ['Stub Author'],
      coverUrl: null,
      firstPublishYear: 2000,
      pageCount: 210,
    });
    await followRepo.create(readerId, ana.id, new Date());
    const session = await sessionRepo.createFinished(ana.id, book.id, {
      startedAt: null,
      finishedAt: new Date(),
    });
    await reviewRepo.create(ana.id, session.id, book.id, {
      rating: 5,
      text: 'excelente',
      containsSpoiler: false,
    });

    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/books/OL_STUB_W/reviews',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.nextCursor).toBeNull();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      author: { userId: ana.id, handle: 'ana', displayName: 'Ana', avatarUrl: null },
      rating: 5,
      text: 'excelente',
      containsSpoiler: false,
    });
    expect(typeof body.items[0].reviewId).toBe('string');
    expect(typeof body.items[0].createdAt).toBe('string');
  });

  it('reviews: 200 empty page when the caller follows nobody with a review', async () => {
    const app = await build();
    await seedBook(app);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/books/OL_STUB_W/reviews',
      headers: { authorization: auth },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [], nextCursor: null });
  });

  it('reviews: 401 without a bearer token', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/v1/books/OL_STUB_W/reviews' });
    expect(res.statusCode).toBe(401);
  });

  it('reviews: 404 for an unknown olid', async () => {
    openLibrary.setDocs([]);
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/books/OL_DOES_NOT_EXIST_W/reviews',
      headers: { authorization: auth },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('BOOK_NOT_FOUND');
  });

  // ---- popular among following ----------------------------------------

  it('popular-among-following: 200 with BookSearchResult items, no cursor; static route not shadowed by :olid', async () => {
    const db = mongo.client.db(DB_NAME);
    const userRepo = new MongoUserRepository(db);
    const bookRepo = new MongoBookRepository(db);
    const followRepo = new MongoFollowRepository(db);
    const sessionRepo = new MongoReadingSessionRepository(db);

    const ana = await userRepo.create({
      email: 'ana2@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'ana2',
      displayName: 'Ana',
    });
    const book = await bookRepo.upsertByOlid({
      olid: 'OL_POP_W',
      isbn13: null,
      title: 'Popular',
      authors: ['A'],
      coverUrl: null,
      firstPublishYear: 2001,
      pageCount: 123,
    });
    await followRepo.create(readerId, ana.id, new Date());
    await sessionRepo.createFinished(ana.id, book.id, { startedAt: null, finishedAt: new Date() });

    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/books/popular-among-following',
      headers: { authorization: auth },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).not.toHaveProperty('nextCursor');
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ olid: 'OL_POP_W', title: 'Popular', pageCount: 123 });
  });

  it('popular-among-following: 200 empty list when the caller follows nobody', async () => {
    const app = await build();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/books/popular-among-following',
      headers: { authorization: auth },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [] });
  });

  it('popular-among-following: 401 without a bearer token', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/v1/books/popular-among-following' });
    expect(res.statusCode).toBe(401);
  });
});
