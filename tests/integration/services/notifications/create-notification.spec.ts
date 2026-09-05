import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoNotificationRepository } from '../../../../src/repositories/notifications';
import { makeCreateNotification } from '../../../../src/services/notifications';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const recipientId = '507f1f77bcf86cd799439011';
const actorId = '507f1f77bcf86cd799439012';

describe('createNotification (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let notificationRepository: MongoNotificationRepository;
  let createNotification: ReturnType<typeof makeCreateNotification>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('create_notification_service_test');
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('notifications').deleteMany({});
    notificationRepository = new MongoNotificationRepository(db);
    createNotification = makeCreateNotification({ notificationRepository, clock: { now: () => new Date() } });
  });

  it('creates a notification when recipient and actor differ', async () => {
    await createNotification({ recipientId, actorId, type: 'follow_request' });

    expect(await notificationRepository.countUnread(recipientId)).toBe(1);
  });

  it('does nothing when the actor is the recipient — no self-notification (RF-009)', async () => {
    await createNotification({ recipientId, actorId: recipientId, type: 'follow_approved' });

    expect(await notificationRepository.countUnread(recipientId)).toBe(0);
  });
});
