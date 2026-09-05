import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoNotificationRepository } from '../../../../src/repositories/notifications';
import { makeGetUnreadNotificationCount } from '../../../../src/services/notifications';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const recipientId = '507f1f77bcf86cd799439011';
const actorId = '507f1f77bcf86cd799439021';

describe('get-unread-notification-count service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let notificationRepository: MongoNotificationRepository;
  let getUnreadNotificationCount: ReturnType<typeof makeGetUnreadNotificationCount>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('get_unread_notification_count_service_test');
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('notifications').deleteMany({});
    notificationRepository = new MongoNotificationRepository(db);
    getUnreadNotificationCount = makeGetUnreadNotificationCount({ notificationRepository });
  });

  it('reflects creation, reading, and removal correctly (008 scenario 15, RF-016)', async () => {
    expect(await getUnreadNotificationCount(recipientId)).toBe(0);

    const a = await notificationRepository.create({ recipientId, actorId, type: 'follow_request' }, new Date());
    await notificationRepository.create({ recipientId, actorId, type: 'follow_approved' }, new Date());
    expect(await getUnreadNotificationCount(recipientId)).toBe(2);

    await notificationRepository.markRead(a.id, new Date());
    expect(await getUnreadNotificationCount(recipientId)).toBe(1);

    await notificationRepository.deleteFollowRequestNotification(recipientId, actorId);
    expect(await getUnreadNotificationCount(recipientId)).toBe(1);
  });
});
