import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoCommentRepository } from '../../../../src/repositories/comments';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const activityId = '507f1f77bcf86cd799439011';
const otherActivityId = '507f1f77bcf86cd799439012';
const sessionId = '507f1f77bcf86cd799439021';
const authorId = '507f1f77bcf86cd799439031';

describe('MongoCommentRepository (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let repo: MongoCommentRepository;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('mongo_comment_repository_test');
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('comments').deleteMany({});
    repo = new MongoCommentRepository(db);
  });

  it('creates a top-level comment with parentCommentId null', async () => {
    const comment = await repo.create(
      { activityId, readingSessionId: sessionId, activityType: 'progress_update', authorId, text: 'Nice!' },
      new Date(),
    );

    expect(comment.parentCommentId).toBeNull();
    expect(comment.deletedAt).toBeNull();
    expect(comment.text).toBe('Nice!');
  });

  it('finds by id and returns null when absent', async () => {
    const created = await repo.create(
      { activityId, readingSessionId: sessionId, activityType: 'progress_update', authorId, text: 'Hi' },
      new Date(),
    );

    expect((await repo.findById(created.id))?.id).toBe(created.id);
    expect(await repo.findById('507f1f77bcf86cd799439999')).toBeNull();
  });

  it('lists comments of an activity in ascending chronological order, paginated by cursor', async () => {
    const now = Date.now();
    const first = await repo.create(
      { activityId, readingSessionId: sessionId, activityType: 'progress_update', authorId, text: 'first' },
      new Date(now),
    );
    const second = await repo.create(
      { activityId, readingSessionId: sessionId, activityType: 'progress_update', authorId, text: 'second' },
      new Date(now + 1000),
    );
    await repo.create(
      { activityId: otherActivityId, readingSessionId: sessionId, activityType: 'progress_update', authorId, text: 'other item' },
      new Date(now + 2000),
    );

    const firstPage = await repo.listByActivity(activityId, null, 1);
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.items[0].id).toBe(first.id);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await repo.listByActivity(activityId, firstPage.nextCursor, 1);
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].id).toBe(second.id);
    expect(secondPage.nextCursor).toBeNull();
  });

  it('softDelete keeps the persisted text but sets deletedAt', async () => {
    const created = await repo.create(
      { activityId, readingSessionId: sessionId, activityType: 'progress_update', authorId, text: 'oops' },
      new Date(),
    );

    const deletedAt = new Date();
    const deleted = await repo.softDelete(created.id, deletedAt);
    expect(deleted?.deletedAt).toEqual(deletedAt);
    expect(deleted?.text).toBe('oops');

    const reloaded = await repo.findById(created.id);
    expect(reloaded?.deletedAt).toEqual(deletedAt);
    expect(reloaded?.text).toBe('oops');
  });

  it('deleteByReadingSessionId removes every activityType of that session', async () => {
    await repo.create(
      { activityId, readingSessionId: sessionId, activityType: 'progress_update', authorId, text: 'a' },
      new Date(),
    );
    await repo.create(
      { activityId: otherActivityId, readingSessionId: sessionId, activityType: 'review_published', authorId, text: 'b' },
      new Date(),
    );
    await repo.create(
      { activityId: 'unrelated', readingSessionId: 'other-session', activityType: 'progress_update', authorId, text: 'c' },
      new Date(),
    );

    await repo.deleteByReadingSessionId(sessionId);

    expect((await repo.listByActivity(activityId, null, 20)).items).toHaveLength(0);
    expect((await repo.listByActivity(otherActivityId, null, 20)).items).toHaveLength(0);
    expect((await repo.listByActivity('unrelated', null, 20)).items).toHaveLength(1);
  });

  it('deleteByReadingSessionIdAndType removes only the given type, keeping the others', async () => {
    await repo.create(
      { activityId, readingSessionId: sessionId, activityType: 'progress_update', authorId, text: 'a' },
      new Date(),
    );
    await repo.create(
      { activityId: otherActivityId, readingSessionId: sessionId, activityType: 'review_published', authorId, text: 'b' },
      new Date(),
    );

    await repo.deleteByReadingSessionIdAndType(sessionId, 'review_published');

    expect((await repo.listByActivity(activityId, null, 20)).items).toHaveLength(1);
    expect((await repo.listByActivity(otherActivityId, null, 20)).items).toHaveLength(0);
  });
});
