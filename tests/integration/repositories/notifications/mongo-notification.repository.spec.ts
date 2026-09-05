import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoNotificationRepository } from '../../../../src/repositories/notifications';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const recipientId = '507f1f77bcf86cd799439011';
const actorId = '507f1f77bcf86cd799439012';
const otherActorId = '507f1f77bcf86cd799439013';
const activityId = '507f1f77bcf86cd799439021';
const otherActivityId = '507f1f77bcf86cd799439022';
const commentId = '507f1f77bcf86cd799439031';
const otherCommentId = '507f1f77bcf86cd799439032';
const sessionId = '507f1f77bcf86cd799439041';

describe('MongoNotificationRepository (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let repo: MongoNotificationRepository;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('mongo_notification_repository_test');
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('notifications').deleteMany({});
    repo = new MongoNotificationRepository(db);
  });

  it('create persists a notification and findById resolves it', async () => {
    const created = await repo.create(
      { recipientId, type: 'follow_request', actorId },
      new Date('2026-01-01T00:00:00.000Z'),
    );

    const found = await repo.findById(created.id);
    expect(found).toMatchObject({
      recipientId,
      type: 'follow_request',
      actorId,
      activityId: null,
      commentId: null,
      readingSessionId: null,
      activityType: null,
      readAt: null,
    });
  });

  it('findById returns null for a nonexistent id', async () => {
    expect(await repo.findById('507f1f77bcf86cd799439099')).toBeNull();
  });

  it('listByRecipient pages descending (newest first) and only for the given recipient', async () => {
    const t1 = new Date('2026-01-01T00:00:00.000Z');
    const t2 = new Date('2026-01-02T00:00:00.000Z');
    const t3 = new Date('2026-01-03T00:00:00.000Z');
    const first = await repo.create({ recipientId, type: 'follow_request', actorId }, t1);
    const second = await repo.create({ recipientId, type: 'follow_approved', actorId }, t2);
    await repo.create({ recipientId: otherActorId, type: 'follow_request', actorId }, t3);

    const page = await repo.listByRecipient(recipientId, null, 20);

    expect(page.items.map((item) => item.id)).toEqual([second.id, first.id]);
    expect(page.nextCursor).toBeNull();
  });

  it('listByRecipient paginates by cursor', async () => {
    const t1 = new Date('2026-01-01T00:00:00.000Z');
    const t2 = new Date('2026-01-02T00:00:00.000Z');
    await repo.create({ recipientId, type: 'follow_request', actorId }, t1);
    await repo.create({ recipientId, type: 'follow_approved', actorId }, t2);

    const firstPage = await repo.listByRecipient(recipientId, null, 1);
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await repo.listByRecipient(recipientId, firstPage.nextCursor, 1);
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
    expect(secondPage.items[0]?.id).not.toBe(firstPage.items[0]?.id);
  });

  it('markRead sets readAt; countUnread and markAllRead reflect it (RF-013 to RF-016)', async () => {
    const a = await repo.create({ recipientId, type: 'follow_request', actorId }, new Date());
    const b = await repo.create({ recipientId, type: 'follow_approved', actorId }, new Date());

    expect(await repo.countUnread(recipientId)).toBe(2);

    await repo.markRead(a.id, new Date('2026-01-05T00:00:00.000Z'));
    expect(await repo.countUnread(recipientId)).toBe(1);
    expect((await repo.findById(a.id))?.readAt).toEqual(new Date('2026-01-05T00:00:00.000Z'));

    const updated = await repo.markAllRead(recipientId, new Date('2026-01-06T00:00:00.000Z'));
    expect(updated).toBe(1);
    expect(await repo.countUnread(recipientId)).toBe(0);
    expect((await repo.findById(b.id))?.readAt).not.toBeNull();
  });

  it('deleteFollowRequestNotification removes only that pair\'s follow_request (D2)', async () => {
    const target = await repo.create({ recipientId, type: 'follow_request', actorId }, new Date());
    const other = await repo.create({ recipientId, type: 'follow_request', actorId: otherActorId }, new Date());

    await repo.deleteFollowRequestNotification(recipientId, actorId);

    expect(await repo.findById(target.id)).toBeNull();
    expect(await repo.findById(other.id)).not.toBeNull();
  });

  it('deleteReactionNotification removes only that activity/actor key (D2)', async () => {
    const target = await repo.create(
      { recipientId, type: 'reaction_on_content', actorId, activityId, readingSessionId: sessionId, activityType: 'progress_update' },
      new Date(),
    );
    const otherActivity = await repo.create(
      { recipientId, type: 'reaction_on_content', actorId, activityId: otherActivityId, readingSessionId: sessionId, activityType: 'progress_update' },
      new Date(),
    );

    await repo.deleteReactionNotification(activityId, actorId);

    expect(await repo.findById(target.id)).toBeNull();
    expect(await repo.findById(otherActivity.id)).not.toBeNull();
  });

  it('deleteByCommentId removes every notification tied to that comment (up to 2, D6)', async () => {
    const onContent = await repo.create(
      { recipientId, type: 'comment_on_content', actorId, activityId, commentId, readingSessionId: sessionId, activityType: 'progress_update' },
      new Date(),
    );
    const reply = await repo.create(
      { recipientId: otherActorId, type: 'comment_reply', actorId, activityId, commentId, readingSessionId: sessionId, activityType: 'progress_update' },
      new Date(),
    );
    const unrelated = await repo.create(
      { recipientId, type: 'comment_on_content', actorId, activityId, commentId: otherCommentId, readingSessionId: sessionId, activityType: 'progress_update' },
      new Date(),
    );

    await repo.deleteByCommentId(commentId);

    expect(await repo.findById(onContent.id)).toBeNull();
    expect(await repo.findById(reply.id)).toBeNull();
    expect(await repo.findById(unrelated.id)).not.toBeNull();
  });

  it('deleteByReadingSessionId removes every activityType of that session', async () => {
    const a = await repo.create(
      { recipientId, type: 'comment_on_content', actorId, activityId, commentId, readingSessionId: sessionId, activityType: 'progress_update' },
      new Date(),
    );
    const b = await repo.create(
      { recipientId, type: 'reaction_on_content', actorId, activityId: otherActivityId, readingSessionId: sessionId, activityType: 'review_published' },
      new Date(),
    );

    await repo.deleteByReadingSessionId(sessionId);

    expect(await repo.findById(a.id)).toBeNull();
    expect(await repo.findById(b.id)).toBeNull();
  });

  it('deleteByReadingSessionIdAndType removes only the given type, keeping the others', async () => {
    const keep = await repo.create(
      { recipientId, type: 'comment_on_content', actorId, activityId, commentId, readingSessionId: sessionId, activityType: 'progress_update' },
      new Date(),
    );
    const gone = await repo.create(
      { recipientId, type: 'reaction_on_content', actorId, activityId: otherActivityId, readingSessionId: sessionId, activityType: 'review_published' },
      new Date(),
    );

    await repo.deleteByReadingSessionIdAndType(sessionId, 'review_published');

    expect(await repo.findById(keep.id)).not.toBeNull();
    expect(await repo.findById(gone.id)).toBeNull();
  });
});
