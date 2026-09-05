import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { NotificationNotFoundError } from '../../../../src/errors';
import { MongoNotificationRepository } from '../../../../src/repositories/notifications';
import { makeMarkNotificationRead } from '../../../../src/services/notifications';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const recipientId = '507f1f77bcf86cd799439011';
const otherUserId = '507f1f77bcf86cd799439012';
const actorId = '507f1f77bcf86cd799439021';

describe('mark-notification-read service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let notificationRepository: MongoNotificationRepository;
  let markNotificationRead: ReturnType<typeof makeMarkNotificationRead>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('mark_notification_read_service_test');
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('notifications').deleteMany({});
    notificationRepository = new MongoNotificationRepository(db);
    markNotificationRead = makeMarkNotificationRead({
      notificationRepository,
      clock: { now: () => new Date('2026-01-05T00:00:00.000Z') },
    });
  });

  it('marks the caller\'s own notification as read (008 scenario 12, RF-013)', async () => {
    const notification = await notificationRepository.create({ recipientId, actorId, type: 'follow_request' }, new Date());

    await markNotificationRead({ userId: recipientId, notificationId: notification.id });

    const found = await notificationRepository.findById(notification.id);
    expect(found?.readAt).toEqual(new Date('2026-01-05T00:00:00.000Z'));
  });

  it('is idempotent — marking an already-read notification again preserves the original readAt (008 scenario 14, RF-015)', async () => {
    const notification = await notificationRepository.create({ recipientId, actorId, type: 'follow_request' }, new Date());
    await notificationRepository.markRead(notification.id, new Date('2026-01-02T00:00:00.000Z'));

    await markNotificationRead({ userId: recipientId, notificationId: notification.id });

    const found = await notificationRepository.findById(notification.id);
    expect(found?.readAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
  });

  it('rejects marking a notification that belongs to someone else', async () => {
    const notification = await notificationRepository.create({ recipientId, actorId, type: 'follow_request' }, new Date());

    await expect(
      markNotificationRead({ userId: otherUserId, notificationId: notification.id }),
    ).rejects.toBeInstanceOf(NotificationNotFoundError);
  });

  it('rejects a nonexistent notification', async () => {
    await expect(
      markNotificationRead({ userId: recipientId, notificationId: '507f1f77bcf86cd799439099' }),
    ).rejects.toBeInstanceOf(NotificationNotFoundError);
  });
});
