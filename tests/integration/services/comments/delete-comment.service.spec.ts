import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CommentNotFoundError } from '../../../../src/errors';
import { MongoActivityRepository } from '../../../../src/repositories/activities';
import { MongoCommentRepository } from '../../../../src/repositories/comments';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { makeResolveVisibleActivity } from '../../../../src/services/activities';
import { makeCreateComment, makeDeleteComment } from '../../../../src/services/comments';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const owner = '507f1f77bcf86cd799439011';
const follower = '507f1f77bcf86cd799439012';
const bookId = '507f1f77bcf86cd799439021';
const sessionId = '507f1f77bcf86cd799439031';

describe('delete-comment service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let activityRepository: MongoActivityRepository;
  let followRepository: MongoFollowRepository;
  let commentRepository: MongoCommentRepository;
  let createComment: ReturnType<typeof makeCreateComment>;
  let deleteComment: ReturnType<typeof makeDeleteComment>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('delete_comment_service_test');
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
    deleteComment = makeDeleteComment({ commentRepository, clock: { now: () => new Date() } });
  });

  it('soft-deletes the author\'s own comment, preserving replies (scenario 7, RF-009)', async () => {
    const activity = await activityRepository.record(
      { type: 'progress_update', actorId: owner, bookId, readingSessionId: sessionId, currentPage: 10 },
      new Date(),
    );
    await followRepository.create(follower, owner, new Date());
    const top = await createComment({ userId: follower, activityId: activity.id, text: 'first' });
    const reply = await createComment({ userId: owner, activityId: activity.id, text: 'reply', parentCommentId: top.id });

    await deleteComment({ userId: follower, commentId: top.id });

    const deleted = await commentRepository.findById(top.id);
    expect(deleted?.deletedAt).not.toBeNull();
    expect(deleted?.text).toBe('first'); // persisted text untouched — only the DTO shows the placeholder

    const stillThere = await commentRepository.findById(reply.id);
    expect(stillThere).not.toBeNull();
  });

  it('rejects deleting a comment that is not the caller\'s own', async () => {
    const activity = await activityRepository.record(
      { type: 'progress_update', actorId: owner, bookId, readingSessionId: sessionId, currentPage: 10 },
      new Date(),
    );
    await followRepository.create(follower, owner, new Date());
    const comment = await createComment({ userId: follower, activityId: activity.id, text: 'mine' });

    await expect(deleteComment({ userId: owner, commentId: comment.id })).rejects.toBeInstanceOf(CommentNotFoundError);
  });

  it('rejects deleting a nonexistent comment', async () => {
    await expect(
      deleteComment({ userId: owner, commentId: '507f1f77bcf86cd799439099' }),
    ).rejects.toBeInstanceOf(CommentNotFoundError);
  });
});
