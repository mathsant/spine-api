import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  ActivityNotFoundError,
  CommentNestingTooDeepError,
  CommentNotFoundError,
  UnsupportedActivityInteractionError,
} from '../../../../src/errors';
import { MongoActivityRepository } from '../../../../src/repositories/activities';
import { MongoCommentRepository } from '../../../../src/repositories/comments';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { makeResolveVisibleActivity } from '../../../../src/services/activities';
import { makeCreateComment } from '../../../../src/services/comments';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const owner = '507f1f77bcf86cd799439011';
const follower = '507f1f77bcf86cd799439012';
const stranger = '507f1f77bcf86cd799439013';
const bookId = '507f1f77bcf86cd799439021';
const sessionId = '507f1f77bcf86cd799439031';

describe('create-comment service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let activityRepository: MongoActivityRepository;
  let followRepository: MongoFollowRepository;
  let commentRepository: MongoCommentRepository;
  let createComment: ReturnType<typeof makeCreateComment>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('create_comment_service_test');
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(['activities', 'follows', 'comments'].map((c) => db.collection(c).deleteMany({})));
    activityRepository = new MongoActivityRepository(db);
    followRepository = new MongoFollowRepository(db);
    commentRepository = new MongoCommentRepository(db);
    const resolveVisibleActivity = makeResolveVisibleActivity({ activityRepository, followRepository });
    createComment = makeCreateComment({ commentRepository, resolveVisibleActivity, clock: { now: () => new Date() } });
  });

  it('creates a top-level comment on a followed user\'s item (scenario 4, RF-005)', async () => {
    const activity = await activityRepository.record(
      { type: 'progress_update', actorId: owner, bookId, readingSessionId: sessionId, currentPage: 10 },
      new Date(),
    );
    await followRepository.create(follower, owner, new Date());

    const comment = await createComment({ userId: follower, activityId: activity.id, text: 'Boa!' });

    expect(comment.text).toBe('Boa!');
    expect(comment.parentCommentId).toBeNull();
    expect(comment.authorId).toBe(follower);
  });

  it('creates a reply to a top-level comment (scenario 5, RF-007)', async () => {
    const activity = await activityRepository.record(
      { type: 'progress_update', actorId: owner, bookId, readingSessionId: sessionId, currentPage: 10 },
      new Date(),
    );
    await followRepository.create(follower, owner, new Date());
    const top = await createComment({ userId: follower, activityId: activity.id, text: 'first' });

    const reply = await createComment({
      userId: owner,
      activityId: activity.id,
      text: 'reply',
      parentCommentId: top.id,
    });

    expect(reply.parentCommentId).toBe(top.id);
  });

  it('rejects replying to a reply — nesting limited to 1 level (scenario 6, RF-010)', async () => {
    const activity = await activityRepository.record(
      { type: 'progress_update', actorId: owner, bookId, readingSessionId: sessionId, currentPage: 10 },
      new Date(),
    );
    await followRepository.create(follower, owner, new Date());
    const top = await createComment({ userId: follower, activityId: activity.id, text: 'first' });
    const reply = await createComment({ userId: owner, activityId: activity.id, text: 'reply', parentCommentId: top.id });

    await expect(
      createComment({ userId: follower, activityId: activity.id, text: 'too deep', parentCommentId: reply.id }),
    ).rejects.toBeInstanceOf(CommentNestingTooDeepError);
  });

  it('rejects a parentCommentId from a different activity', async () => {
    const activity = await activityRepository.record(
      { type: 'progress_update', actorId: owner, bookId, readingSessionId: sessionId, currentPage: 10 },
      new Date(),
    );
    const otherActivity = await activityRepository.record(
      { type: 'finished_reading', actorId: owner, bookId, readingSessionId: sessionId },
      new Date(),
    );
    await followRepository.create(follower, owner, new Date());
    const topOnOther = await createComment({ userId: follower, activityId: otherActivity.id, text: 'first' });

    await expect(
      createComment({ userId: follower, activityId: activity.id, text: 'oops', parentCommentId: topOnOther.id }),
    ).rejects.toBeInstanceOf(CommentNotFoundError);
  });

  it('allows the owner to comment on their own item (scenario 8, RF-014)', async () => {
    const activity = await activityRepository.record(
      { type: 'review_published', actorId: owner, bookId, readingSessionId: sessionId },
      new Date(),
    );

    const comment = await createComment({ userId: owner, activityId: activity.id, text: 'note to self' });
    expect(comment.authorId).toBe(owner);
  });

  it('rejects a non-follower (RF-012)', async () => {
    const activity = await activityRepository.record(
      { type: 'progress_update', actorId: owner, bookId, readingSessionId: sessionId, currentPage: 5 },
      new Date(),
    );

    await expect(
      createComment({ userId: stranger, activityId: activity.id, text: 'oi' }),
    ).rejects.toBeInstanceOf(ActivityNotFoundError);
  });

  it('rejects a started_reading target (scenario 11, RF-011)', async () => {
    const activity = await activityRepository.record(
      { type: 'started_reading', actorId: owner, bookId, readingSessionId: sessionId },
      new Date(),
    );

    await expect(
      createComment({ userId: owner, activityId: activity.id, text: 'oi' }),
    ).rejects.toBeInstanceOf(UnsupportedActivityInteractionError);
  });

  it('persists the denormalized readingSessionId/activityType for cascade (D3)', async () => {
    const activity = await activityRepository.record(
      { type: 'review_published', actorId: owner, bookId, readingSessionId: sessionId },
      new Date(),
    );

    const comment = await createComment({ userId: owner, activityId: activity.id, text: 'nice' });

    const stored = await commentRepository.findById(comment.id);
    expect(stored?.readingSessionId).toBe(sessionId);
    expect(stored?.activityType).toBe('review_published');
  });
});
