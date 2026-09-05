import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoNotificationRepository } from '../../../../src/repositories/notifications';
import { makeListNotifications } from '../../../../src/services/notifications';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const recipientId = '507f1f77bcf86cd799439011';
const otherRecipientId = '507f1f77bcf86cd799439012';
const actorId = '507f1f77bcf86cd799439021';

describe('list-notifications service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let notificationRepository: MongoNotificationRepository;
  let listNotifications: ReturnType<typeof makeListNotifications>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('list_notifications_service_test');
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('notifications').deleteMany({});
    notificationRepository = new MongoNotificationRepository(db);
    listNotifications = makeListNotifications({ notificationRepository });
  });

  it('lists only the caller\'s own notifications, newest first (008 scenario 11, RF-011/RF-012)', async () => {
    const t1 = new Date('2026-01-01T00:00:00.000Z');
    const t2 = new Date('2026-01-02T00:00:00.000Z');
    await notificationRepository.create({ recipientId, actorId, type: 'follow_request' }, t1);
    const second = await notificationRepository.create({ recipientId, actorId, type: 'follow_approved' }, t2);
    await notificationRepository.create({ recipientId: otherRecipientId, actorId, type: 'follow_request' }, t2);

    const page = await listNotifications({ userId: recipientId, cursor: null, limit: 20 });

    expect(page.items).toHaveLength(2);
    expect(page.items[0]?.id).toBe(second.id);
    expect(page.items[0]?.type).toBe('follow_approved');
  });

  it('paginates by cursor', async () => {
    await notificationRepository.create({ recipientId, actorId, type: 'follow_request' }, new Date('2026-01-01T00:00:00.000Z'));
    await notificationRepository.create({ recipientId, actorId, type: 'follow_approved' }, new Date('2026-01-02T00:00:00.000Z'));

    const firstPage = await listNotifications({ userId: recipientId, cursor: null, limit: 1 });
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await listNotifications({ userId: recipientId, cursor: firstPage.nextCursor, limit: 1 });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
  });
});
