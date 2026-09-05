import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ActivityNotFoundError } from '../../../../src/errors';
import { MongoActivityRepository } from '../../../../src/repositories/activities';
import { MongoCommentRepository } from '../../../../src/repositories/comments';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { MongoNotificationRepository } from '../../../../src/repositories/notifications';
import { makeResolveVisibleActivity } from '../../../../src/services/activities';
import { makeCreateComment, makeListComments } from '../../../../src/services/comments';
import { makeCreateNotification } from '../../../../src/services/notifications';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const owner = '507f1f77bcf86cd799439011';
const follower = '507f1f77bcf86cd799439012';
const stranger = '507f1f77bcf86cd799439013';
const bookId = '507f1f77bcf86cd799439021';
const sessionId = '507f1f77bcf86cd799439031';

describe('list-comments service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let activityRepository: MongoActivityRepository;
  let followRepository: MongoFollowRepository;
  let commentRepository: MongoCommentRepository;
  let createComment: ReturnType<typeof makeCreateComment>;
  let listComments: ReturnType<typeof makeListComments>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('list_comments_service_test');
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      ['activities', 'follows', 'comments', 'notifications'].map((c) => db.collection(c).deleteMany({})),
    );
    activityRepository = new MongoActivityRepository(db);
    followRepository = new MongoFollowRepository(db);
    commentRepository = new MongoCommentRepository(db);
    const notificationRepository = new MongoNotificationRepository(db);
    const resolveVisibleActivity = makeResolveVisibleActivity({ activityRepository, followRepository });
    createComment = makeCreateComment({
      commentRepository,
      resolveVisibleActivity,
      createNotification: makeCreateNotification({ notificationRepository, clock: { now: () => new Date() } }),
      clock: { now: () => new Date() },
    });
    listComments = makeListComments({ commentRepository, resolveVisibleActivity });
  });

  it('lists comments in ascending chronological order, paginated by cursor (RF-008)', async () => {
    const activity = await activityRepository.record(
      { type: 'progress_update', actorId: owner, bookId, readingSessionId: sessionId, currentPage: 10 },
      new Date(),
    );
    await followRepository.create(follower, owner, new Date());
    const first = await createComment({ userId: follower, activityId: activity.id, text: 'first' });
    const second = await createComment({ userId: owner, activityId: activity.id, text: 'second' });

    const firstPage = await listComments({ userId: follower, activityId: activity.id, cursor: null, limit: 1 });
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.items[0].id).toBe(first.id);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await listComments({
      userId: follower,
      activityId: activity.id,
      cursor: firstPage.nextCursor,
      limit: 1,
    });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].id).toBe(second.id);
    expect(secondPage.nextCursor).toBeNull();
  });

  it('still accepts a reply to a soft-deleted top-level comment (edge case)', async () => {
    const activity = await activityRepository.record(
      { type: 'progress_update', actorId: owner, bookId, readingSessionId: sessionId, currentPage: 10 },
      new Date(),
    );
    await followRepository.create(follower, owner, new Date());
    const top = await createComment({ userId: follower, activityId: activity.id, text: 'first' });
    await commentRepository.softDelete(top.id, new Date());

    const reply = await createComment({
      userId: owner,
      activityId: activity.id,
      text: 'still replying',
      parentCommentId: top.id,
    });

    expect(reply.parentCommentId).toBe(top.id);

    const page = await listComments({ userId: follower, activityId: activity.id, cursor: null, limit: 20 });
    expect(page.items.map((item) => item.text)).toEqual(['[removido]', 'still replying']);
  });

  it('rejects a non-follower (RF-012)', async () => {
    const activity = await activityRepository.record(
      { type: 'progress_update', actorId: owner, bookId, readingSessionId: sessionId, currentPage: 5 },
      new Date(),
    );

    await expect(
      listComments({ userId: stranger, activityId: activity.id, cursor: null, limit: 20 }),
    ).rejects.toBeInstanceOf(ActivityNotFoundError);
  });
});
