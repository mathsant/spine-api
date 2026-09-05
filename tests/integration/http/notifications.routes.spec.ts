import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { signAccessToken } from '../../../src/auth';
import { buildApp } from '../../../src/app';
import type { AppConfig } from '../../../src/config';
import { MongoNotificationRepository } from '../../../src/repositories/notifications';
import { MongoUserRepository } from '../../../src/repositories/users';
import { ensureAuthIndexes } from '../../helpers/auth-indexes';
import { testConfig } from '../../helpers/config';
import { type MongoMemory, startMongoMemory } from '../../helpers/mongo-memory';

const DB_NAME = 'notifications_routes_test';
const SECRET = testConfig().accessTokenSecret;

describe('notifications routes (integration)', () => {
  let mongo: MongoMemory;
  let apps: FastifyInstance[] = [];
  let recipientAuth: string;
  let recipientId: string;
  let otherAuth: string;
  let actorId: string;
  let notificationRepository: MongoNotificationRepository;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    const db = mongo.client.db(DB_NAME);
    await ensureAuthIndexes(db);

    const users = new MongoUserRepository(db);
    const recipient = await users.create({
      email: 'recipient@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'recipient',
      displayName: 'Recipient',
    });
    const other = await users.create({
      email: 'other@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'other',
      displayName: 'Other',
    });
    const actor = await users.create({
      email: 'actor@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'actor',
      displayName: 'Actor',
    });
    recipientId = recipient.id;
    actorId = actor.id;
    recipientAuth = `Bearer ${signAccessToken({ userId: recipient.id }, SECRET)}`;
    otherAuth = `Bearer ${signAccessToken({ userId: other.id }, SECRET)}`;

    notificationRepository = new MongoNotificationRepository(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    const db = mongo.client.db(DB_NAME);
    await db.collection('notifications').deleteMany({});
  });

  afterEach(async () => {
    await Promise.all(apps.map((a) => a.close()));
    apps = [];
  });

  async function build(overrides: Partial<AppConfig> = {}): Promise<FastifyInstance> {
    const app = await buildApp(testConfig({ mongoUri: mongo.uri, mongoDbName: DB_NAME, ...overrides }));
    apps.push(app);
    return app;
  }

  it('lists the caller\'s own notifications (200) and reports the unread count', async () => {
    const app = await build();
    await notificationRepository.create({ recipientId, actorId, type: 'follow_request' }, new Date());

    const listed = await app.inject({
      method: 'GET',
      url: '/v1/me/notifications',
      headers: { authorization: recipientAuth },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().items).toHaveLength(1);
    expect(listed.json().items[0]).toMatchObject({ type: 'follow_request', actorId, read: false });

    const count = await app.inject({
      method: 'GET',
      url: '/v1/me/notifications/unread-count',
      headers: { authorization: recipientAuth },
    });
    expect(count.statusCode).toBe(200);
    expect(count.json()).toEqual({ count: 1 });
  });

  it('rejects an invalid limit with 400 VALIDATION_ERROR', async () => {
    const app = await build();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/me/notifications?limit=0',
      headers: { authorization: recipientAuth },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('marks a notification as read (204), idempotently, and rejects someone else\'s notification', async () => {
    const app = await build();
    const notification = await notificationRepository.create({ recipientId, actorId, type: 'follow_request' }, new Date());

    const first = await app.inject({
      method: 'POST',
      url: `/v1/notifications/${notification.id}/read`,
      headers: { authorization: recipientAuth },
    });
    expect(first.statusCode).toBe(204);

    const again = await app.inject({
      method: 'POST',
      url: `/v1/notifications/${notification.id}/read`,
      headers: { authorization: recipientAuth },
    });
    expect(again.statusCode).toBe(204);

    const count = await app.inject({
      method: 'GET',
      url: '/v1/me/notifications/unread-count',
      headers: { authorization: recipientAuth },
    });
    expect(count.json()).toEqual({ count: 0 });

    const forbidden = await app.inject({
      method: 'POST',
      url: `/v1/notifications/${notification.id}/read`,
      headers: { authorization: otherAuth },
    });
    expect(forbidden.statusCode).toBe(404);
    expect(forbidden.json().error.code).toBe('NOTIFICATION_NOT_FOUND');
  });

  it('marks every unread notification as read (204)', async () => {
    const app = await build();
    await notificationRepository.create({ recipientId, actorId, type: 'follow_request' }, new Date());
    await notificationRepository.create({ recipientId, actorId, type: 'follow_approved' }, new Date());

    const res = await app.inject({
      method: 'POST',
      url: '/v1/notifications/read-all',
      headers: { authorization: recipientAuth },
    });
    expect(res.statusCode).toBe(204);

    const count = await app.inject({
      method: 'GET',
      url: '/v1/me/notifications/unread-count',
      headers: { authorization: recipientAuth },
    });
    expect(count.json()).toEqual({ count: 0 });
  });

  it('rejects without authentication (401)', async () => {
    const app = await build();

    const res = await app.inject({ method: 'GET', url: '/v1/me/notifications' });
    expect(res.statusCode).toBe(401);
  });
});
