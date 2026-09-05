import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoNotificationRepository } from '../../../../src/repositories/notifications';
import { makeMarkAllNotificationsRead } from '../../../../src/services/notifications';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const recipientId = '507f1f77bcf86cd799439011';
const actorId = '507f1f77bcf86cd799439021';

describe('mark-all-notifications-read service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let notificationRepository: MongoNotificationRepository;
  let markAllNotificationsRead: ReturnType<typeof makeMarkAllNotificationsRead>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('mark_all_notifications_read_service_test');
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('notifications').deleteMany({});
    notificationRepository = new MongoNotificationRepository(db);
    markAllNotificationsRead = makeMarkAllNotificationsRead({ notificationRepository, clock: { now: () => new Date() } });
  });

  it('marks every unread notification of the caller as read (008 scenario 13, RF-014)', async () => {
    await notificationRepository.create({ recipientId, actorId, type: 'follow_request' }, new Date());
    await notificationRepository.create({ recipientId, actorId, type: 'follow_approved' }, new Date());

    await markAllNotificationsRead(recipientId);

    expect(await notificationRepository.countUnread(recipientId)).toBe(0);
  });

  it('running it again is idempotent — no error, nothing left to update', async () => {
    await notificationRepository.create({ recipientId, actorId, type: 'follow_request' }, new Date());

    await markAllNotificationsRead(recipientId);
    await expect(markAllNotificationsRead(recipientId)).resolves.toBeUndefined();

    expect(await notificationRepository.countUnread(recipientId)).toBe(0);
  });
});
