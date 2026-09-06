import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { BookNotFoundError } from '../../../../src/errors';
import { MongoBookRepository } from '../../../../src/repositories/books';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { MongoReadingSessionRepository } from '../../../../src/repositories/reading-sessions';
import { MongoReviewRepository } from '../../../../src/repositories/reviews';
import { MongoUserRepository } from '../../../../src/repositories/users';
import { makeListBookReviews } from '../../../../src/services/books';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { ensureReviewIndexes } from '../../../helpers/review-indexes';
import { aSearchResult, FakeOpenLibraryClient } from '../../../helpers/fake-open-library-client';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const OLID = 'OL12345W';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('list-book-reviews service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let bookRepository: MongoBookRepository;
  let followRepository: MongoFollowRepository;
  let readingSessionRepository: MongoReadingSessionRepository;
  let reviewRepository: MongoReviewRepository;
  let userRepository: MongoUserRepository;
  let openLibraryClient: FakeOpenLibraryClient;
  let listBookReviews: ReturnType<typeof makeListBookReviews>;
  let bookId: string;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('list_book_reviews_service_test');
    await ensureAuthIndexes(db);
    await ensureBookIndexes(db);
    await ensureFollowIndexes(db);
    await ensureReviewIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      ['users', 'books', 'follows', 'reading_sessions', 'reviews'].map((c) =>
        db.collection(c).deleteMany({}),
      ),
    );
    bookRepository = new MongoBookRepository(db);
    followRepository = new MongoFollowRepository(db);
    readingSessionRepository = new MongoReadingSessionRepository(db);
    reviewRepository = new MongoReviewRepository(db);
    userRepository = new MongoUserRepository(db);
    openLibraryClient = new FakeOpenLibraryClient();
    listBookReviews = makeListBookReviews({
      bookRepository,
      openLibraryClient,
      followRepository,
      readingSessionRepository,
      reviewRepository,
      userRepository,
    });

    const book = await bookRepository.upsertByOlid(aSearchResult({ olid: OLID }));
    bookId = book.id;
  });

  async function aUser(handle: string) {
    return userRepository.create({
      email: `${handle}@example.com`,
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle,
      displayName: handle.toUpperCase(),
    });
  }

  async function aReview(
    userId: string,
    input: { rating: number; text?: string | null; containsSpoiler?: boolean } = { rating: 4 },
  ) {
    const session = await readingSessionRepository.createFinished(userId, bookId, {
      startedAt: null,
      finishedAt: new Date(),
    });
    return reviewRepository.create(userId, session.id, bookId, input);
  }

  it('returns one review per followed user, with author block and newest first (RF-006, RF-010, RF-011)', async () => {
    const me = await aUser('me');
    const ana = await aUser('ana');
    const bruno = await aUser('bruno');
    await followRepository.create(me.id, ana.id, new Date());
    await followRepository.create(me.id, bruno.id, new Date());

    await aReview(bruno.id, { rating: 3, text: 'ok', containsSpoiler: false });
    await sleep(5);
    await aReview(ana.id, { rating: 5, text: 'amei', containsSpoiler: true });

    const page = await listBookReviews({ userId: me.id, olid: OLID, cursor: null, limit: 20 });

    expect(page.items.map((item) => item.author.userId)).toEqual([ana.id, bruno.id]);
    expect(page.items[0]).toMatchObject({
      author: { userId: ana.id, handle: 'ana', displayName: 'ANA', avatarUrl: null },
      rating: 5,
      text: 'amei',
      containsSpoiler: true,
    });
    expect(typeof page.items[0].reviewId).toBe('string');
    expect(typeof page.items[0].createdAt).toBe('string');
    expect(page.nextCursor).toBeNull();
  });

  it('keeps only the most recent finished session review when a followed user reread (RF-007)', async () => {
    const me = await aUser('me');
    const ana = await aUser('ana');
    await followRepository.create(me.id, ana.id, new Date());

    await aReview(ana.id, { rating: 2 });
    await sleep(5);
    const latest = await aReview(ana.id, { rating: 5 });

    const page = await listBookReviews({ userId: me.id, olid: OLID, cursor: null, limit: 20 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0].reviewId).toBe(latest.id);
    expect(page.items[0].rating).toBe(5);
  });

  it("never includes the caller's own review (RF-008)", async () => {
    const me = await aUser('me');
    const ana = await aUser('ana');
    await followRepository.create(me.id, ana.id, new Date());

    await aReview(me.id, { rating: 1 });
    await aReview(ana.id, { rating: 4 });

    const page = await listBookReviews({ userId: me.id, olid: OLID, cursor: null, limit: 20 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0].author.userId).toBe(ana.id);
  });

  it('excludes reviews from users the caller does not follow (P6, RF-009)', async () => {
    const me = await aUser('me');
    const stranger = await aUser('stranger');

    await aReview(stranger.id, { rating: 5 });

    const page = await listBookReviews({ userId: me.id, olid: OLID, cursor: null, limit: 20 });
    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it('returns an empty page when the caller follows nobody', async () => {
    const me = await aUser('me');
    const page = await listBookReviews({ userId: me.id, olid: OLID, cursor: null, limit: 20 });
    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it('throws BookNotFoundError when the olid resolves to nothing (RF-012)', async () => {
    const me = await aUser('me');
    await expect(
      listBookReviews({ userId: me.id, olid: 'OL_GHOST_W', cursor: null, limit: 20 }),
    ).rejects.toBeInstanceOf(BookNotFoundError);
  });

  it('paginates by cursor without repetition or omission (RF-011)', async () => {
    const me = await aUser('me');
    const followees = await Promise.all([aUser('u1'), aUser('u2'), aUser('u3')]);
    for (const followee of followees) {
      await followRepository.create(me.id, followee.id, new Date());
      await aReview(followee.id, { rating: 4 });
      await sleep(5);
    }

    const first = await listBookReviews({ userId: me.id, olid: OLID, cursor: null, limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const second = await listBookReviews({
      userId: me.id,
      olid: OLID,
      cursor: first.nextCursor,
      limit: 2,
    });
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();

    const seen = [...first.items, ...second.items].map((item) => item.reviewId);
    expect(new Set(seen).size).toBe(3);
  });
});
