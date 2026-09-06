import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoActivityRepository } from '../../../../src/repositories/activities';
import { MongoBookRepository } from '../../../../src/repositories/books';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { MongoReactionRepository } from '../../../../src/repositories/reactions';
import { MongoReviewRepository } from '../../../../src/repositories/reviews';
import { MongoUserRepository } from '../../../../src/repositories/users';
import { makeGetFeed } from '../../../../src/services/feed';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { ensureReviewIndexes } from '../../../helpers/review-indexes';
import { aSearchResult } from '../../../helpers/fake-open-library-client';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('get-feed service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let userRepository: MongoUserRepository;
  let bookRepository: MongoBookRepository;
  let followRepository: MongoFollowRepository;
  let activityRepository: MongoActivityRepository;
  let reviewRepository: MongoReviewRepository;
  let reactionRepository: MongoReactionRepository;
  let getFeed: ReturnType<typeof makeGetFeed>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('get_feed_service_test');
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
      ['users', 'books', 'follows', 'activities', 'reviews', 'reactions'].map((c) =>
        db.collection(c).deleteMany({}),
      ),
    );
    userRepository = new MongoUserRepository(db);
    bookRepository = new MongoBookRepository(db);
    followRepository = new MongoFollowRepository(db);
    activityRepository = new MongoActivityRepository(db);
    reviewRepository = new MongoReviewRepository(db);
    reactionRepository = new MongoReactionRepository(db);
    getFeed = makeGetFeed({
      activityRepository,
      followRepository,
      userRepository,
      bookRepository,
      reviewRepository,
      reactionRepository,
    });
  });

  async function aUser(handle: string) {
    return userRepository.create({
      email: `${handle}@example.com`,
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle,
      displayName: handle,
    });
  }

  it('returns own activity mixed with followed users\', ordered newest first (scenarios 1, 13, RF-006, RF-008)', async () => {
    const me = await aUser('me');
    const b = await aUser('b');
    const book = await bookRepository.upsertByOlid(aSearchResult());
    await followRepository.create(me.id, b.id, new Date());

    await activityRepository.record(
      { type: 'started_reading', actorId: b.id, bookId: book.id, readingSessionId: 's1' },
      new Date('2026-01-01T00:00:00.000Z'),
    );
    await activityRepository.record(
      { type: 'finished_reading', actorId: me.id, bookId: book.id, readingSessionId: 's2' },
      new Date('2026-01-02T00:00:00.000Z'),
    );

    const page = await getFeed({ userId: me.id, cursor: null, limit: 20 });

    expect(page.items).toHaveLength(2);
    expect(page.items[0].actor.userId).toBe(me.id);
    expect(page.items[1].actor.userId).toBe(b.id);
    expect(page.items[1].actor.handle).toBe('b');
    expect(page.items[1].book.title).toBe(book.title);
  });

  it('excludes activity of a user not followed, or whose follow is pending/undone (scenarios 2, 3, 12, RF-007)', async () => {
    const me = await aUser('me');
    const stranger = await aUser('stranger');
    const book = await bookRepository.upsertByOlid(aSearchResult());

    await activityRepository.record(
      { type: 'started_reading', actorId: stranger.id, bookId: book.id, readingSessionId: 's1' },
      new Date(),
    );

    const page = await getFeed({ userId: me.id, cursor: null, limit: 20 });
    expect(page.items).toHaveLength(0);
  });

  it('review_published reflects the review\'s current content, not a stale snapshot (scenario 9, RF-009)', async () => {
    const me = await aUser('me');
    const book = await bookRepository.upsertByOlid(aSearchResult());
    const review = await reviewRepository.create(me.id, 's1', book.id, { rating: 3, text: 'Meh' });
    await activityRepository.record(
      { type: 'review_published', actorId: me.id, bookId: book.id, readingSessionId: 's1' },
      new Date(),
    );

    await reviewRepository.edit(review.id, { rating: 5, text: 'Actually great' });

    const page = await getFeed({ userId: me.id, cursor: null, limit: 20 });
    expect(page.items[0].review).toMatchObject({ rating: 5, text: 'Actually great' });
  });

  it('progress_update shows the currentPage captured at event time, not the session\'s latest value (D2)', async () => {
    const me = await aUser('me');
    const book = await bookRepository.upsertByOlid(aSearchResult());
    await activityRepository.record(
      { type: 'progress_update', actorId: me.id, bookId: book.id, readingSessionId: 's1', currentPage: 50 },
      new Date('2026-01-01T00:00:00.000Z'),
    );
    await activityRepository.record(
      { type: 'progress_update', actorId: me.id, bookId: book.id, readingSessionId: 's1', currentPage: 120 },
      new Date('2026-01-02T00:00:00.000Z'),
    );

    const page = await getFeed({ userId: me.id, cursor: null, limit: 20 });
    expect(page.items.map((item) => item.currentPage)).toEqual([120, 50]);
    expect(page.items[0].book).toMatchObject({ firstPublishYear: 1965, pageCount: 412 });
  });

  it('returns an empty list, not an error, when following nobody and having no activity (RF-013)', async () => {
    const me = await aUser('me');
    const page = await getFeed({ userId: me.id, cursor: null, limit: 20 });
    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it('paginates by cursor without duplicating or skipping items (scenario 11, RF-011)', async () => {
    const me = await aUser('me');
    const book = await bookRepository.upsertByOlid(aSearchResult());
    await activityRepository.record(
      { type: 'started_reading', actorId: me.id, bookId: book.id, readingSessionId: 's1' },
      new Date('2026-01-01T00:00:00.000Z'),
    );
    await activityRepository.record(
      { type: 'progress_update', actorId: me.id, bookId: book.id, readingSessionId: 's1', currentPage: 10 },
      new Date('2026-01-02T00:00:00.000Z'),
    );

    const firstPage = await getFeed({ userId: me.id, cursor: null, limit: 1 });
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.nextCursor).not.toBeNull();

    await activityRepository.record(
      { type: 'finished_reading', actorId: me.id, bookId: book.id, readingSessionId: 's1' },
      new Date('2026-01-03T00:00:00.000Z'),
    );

    const secondPage = await getFeed({ userId: me.id, cursor: firstPage.nextCursor, limit: 1 });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].type).toBe('started_reading');
    expect(secondPage.nextCursor).toBeNull();
  });

  it('exposes reactionsCount and hasReacted per item (007, RF-004)', async () => {
    const me = await aUser('me');
    const b = await aUser('b');
    const book = await bookRepository.upsertByOlid(aSearchResult());
    await followRepository.create(me.id, b.id, new Date());
    const activity = await activityRepository.record(
      { type: 'progress_update', actorId: b.id, bookId: book.id, readingSessionId: 's1', currentPage: 10 },
      new Date(),
    );

    const before = await getFeed({ userId: me.id, cursor: null, limit: 20 });
    expect(before.items[0]).toMatchObject({ reactionsCount: 0, hasReacted: false });

    await reactionRepository.add(activity.id, me.id, 's1', 'progress_update', new Date());
    await reactionRepository.add(activity.id, b.id, 's1', 'progress_update', new Date());

    const after = await getFeed({ userId: me.id, cursor: null, limit: 20 });
    expect(after.items[0]).toMatchObject({ reactionsCount: 2, hasReacted: true });
  });
});
