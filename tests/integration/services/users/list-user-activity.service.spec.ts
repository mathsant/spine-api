import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { UserNotFoundError } from '../../../../src/errors';
import { MongoActivityRepository } from '../../../../src/repositories/activities';
import { MongoBookRepository } from '../../../../src/repositories/books';
import { MongoFollowRequestRepository } from '../../../../src/repositories/follow-requests';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { MongoReactionRepository } from '../../../../src/repositories/reactions';
import { MongoReviewRepository } from '../../../../src/repositories/reviews';
import { MongoUserRepository } from '../../../../src/repositories/users';
import { makeListUserActivity } from '../../../../src/services/users';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { ensureReviewIndexes } from '../../../helpers/review-indexes';
import { aSearchResult } from '../../../helpers/fake-open-library-client';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('list-user-activity service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let userRepository: MongoUserRepository;
  let bookRepository: MongoBookRepository;
  let followRepository: MongoFollowRepository;
  let followRequestRepository: MongoFollowRequestRepository;
  let activityRepository: MongoActivityRepository;
  let reviewRepository: MongoReviewRepository;
  let reactionRepository: MongoReactionRepository;
  let listUserActivity: ReturnType<typeof makeListUserActivity>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('list_user_activity_service_test');
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
      ['users', 'books', 'follows', 'follow_requests', 'activities', 'reviews', 'reactions'].map(
        (c) => db.collection(c).deleteMany({}),
      ),
    );
    userRepository = new MongoUserRepository(db);
    bookRepository = new MongoBookRepository(db);
    followRepository = new MongoFollowRepository(db);
    followRequestRepository = new MongoFollowRequestRepository(db);
    activityRepository = new MongoActivityRepository(db);
    reviewRepository = new MongoReviewRepository(db);
    reactionRepository = new MongoReactionRepository(db);
    listUserActivity = makeListUserActivity({
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

  it('returns the target activity as feed items, newest first, for an approved follower (scenario 8)', async () => {
    const viewer = await aUser('viewer');
    const target = await aUser('target');
    const book = await bookRepository.upsertByOlid(aSearchResult());
    await followRepository.create(viewer.id, target.id, new Date());

    await activityRepository.record(
      { type: 'started_reading', actorId: target.id, bookId: book.id, readingSessionId: 's1' },
      new Date('2026-01-01T00:00:00.000Z'),
    );
    await activityRepository.record(
      { type: 'finished_reading', actorId: target.id, bookId: book.id, readingSessionId: 's1' },
      new Date('2026-01-02T00:00:00.000Z'),
    );

    const page = await listUserActivity({
      viewerId: viewer.id,
      userId: target.id,
      cursor: null,
      limit: 20,
    });

    expect(page.items.map((i) => i.type)).toEqual(['finished_reading', 'started_reading']);
    expect(page.items[0].actor.userId).toBe(target.id);
    expect(page.items[0].id).toEqual(expect.any(String));
  });

  it('paginates by cursor without duplicating or skipping (scenario 9)', async () => {
    const viewer = await aUser('viewer');
    const target = await aUser('target');
    const book = await bookRepository.upsertByOlid(aSearchResult());
    await followRepository.create(viewer.id, target.id, new Date());

    for (let i = 0; i < 5; i += 1) {
      await activityRepository.record(
        { type: 'progress_update', actorId: target.id, bookId: book.id, readingSessionId: 's1', currentPage: i + 1 },
        new Date(`2026-01-0${i + 1}T00:00:00.000Z`),
      );
    }

    const first = await listUserActivity({ viewerId: viewer.id, userId: target.id, cursor: null, limit: 2 });
    const second = await listUserActivity({
      viewerId: viewer.id,
      userId: target.id,
      cursor: first.nextCursor,
      limit: 2,
    });
    const third = await listUserActivity({
      viewerId: viewer.id,
      userId: target.id,
      cursor: second.nextCursor,
      limit: 2,
    });

    const ids = [...first.items, ...second.items, ...third.items].map((i) => i.id);
    expect(new Set(ids).size).toBe(5);
    expect(third.nextCursor).toBeNull();
  });

  it('throws a neutral UserNotFoundError when the viewer does not approve-follow the target (scenario 10)', async () => {
    const viewer = await aUser('viewer');
    const target = await aUser('target');
    await followRequestRepository.create(viewer.id, target.id, new Date()); // pending, not approved

    await expect(
      listUserActivity({ viewerId: viewer.id, userId: target.id, cursor: null, limit: 20 }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('throws UserNotFoundError for a nonexistent and a malformed id (scenario 11)', async () => {
    const viewer = await aUser('viewer');

    await expect(
      listUserActivity({ viewerId: viewer.id, userId: '507f1f77bcf86cd799439099', cursor: null, limit: 20 }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
    await expect(
      listUserActivity({ viewerId: viewer.id, userId: 'not-an-id', cursor: null, limit: 20 }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('lets the viewer see their own activity (scenario 12)', async () => {
    const me = await aUser('me');
    const book = await bookRepository.upsertByOlid(aSearchResult());
    await activityRepository.record(
      { type: 'started_reading', actorId: me.id, bookId: book.id, readingSessionId: 's1' },
      new Date(),
    );

    const page = await listUserActivity({ viewerId: me.id, userId: me.id, cursor: null, limit: 20 });
    expect(page.items).toHaveLength(1);
  });

  it('returns an empty page when the target is accessible but has no activity (scenario 13)', async () => {
    const viewer = await aUser('viewer');
    const target = await aUser('target');
    await followRepository.create(viewer.id, target.id, new Date());

    const page = await listUserActivity({ viewerId: viewer.id, userId: target.id, cursor: null, limit: 20 });
    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it('includes started_reading items with zeroed reaction fields (scenario 14)', async () => {
    const viewer = await aUser('viewer');
    const target = await aUser('target');
    const book = await bookRepository.upsertByOlid(aSearchResult());
    await followRepository.create(viewer.id, target.id, new Date());
    await activityRepository.record(
      { type: 'started_reading', actorId: target.id, bookId: book.id, readingSessionId: 's1' },
      new Date(),
    );

    const page = await listUserActivity({ viewerId: viewer.id, userId: target.id, cursor: null, limit: 20 });
    expect(page.items[0]).toMatchObject({ type: 'started_reading', reactionsCount: 0, hasReacted: false });
  });

  it('stops returning activity once the follow is undone (scenario 15)', async () => {
    const viewer = await aUser('viewer');
    const target = await aUser('target');
    await followRepository.create(viewer.id, target.id, new Date());
    await followRepository.deleteByPair(viewer.id, target.id);

    await expect(
      listUserActivity({ viewerId: viewer.id, userId: target.id, cursor: null, limit: 20 }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
