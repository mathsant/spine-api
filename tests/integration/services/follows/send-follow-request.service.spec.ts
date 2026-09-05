import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AlreadyFollowingError, CannotFollowSelfError, NotFoundError } from '../../../../src/errors';
import { MongoFollowRequestRepository } from '../../../../src/repositories/follow-requests';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { MongoNotificationRepository } from '../../../../src/repositories/notifications';
import { MongoUserRepository } from '../../../../src/repositories/users';
import { makeCreateNotification } from '../../../../src/services/notifications';
import { makeSendFollowRequest } from '../../../../src/services/follows';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const clock = { now: () => new Date('2025-06-01T00:00:00.000Z') };

describe('send-follow-request service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let userRepository: MongoUserRepository;
  let followRequestRepository: MongoFollowRequestRepository;
  let followRepository: MongoFollowRepository;
  let notificationRepository: MongoNotificationRepository;
  let sendFollowRequest: ReturnType<typeof makeSendFollowRequest>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('send_follow_request_service_test');
    await ensureAuthIndexes(db);
    await ensureFollowIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      ['users', 'follow_requests', 'follows', 'notifications'].map((c) => db.collection(c).deleteMany({})),
    );
    userRepository = new MongoUserRepository(db);
    followRequestRepository = new MongoFollowRequestRepository(db);
    followRepository = new MongoFollowRepository(db);
    notificationRepository = new MongoNotificationRepository(db);
    sendFollowRequest = makeSendFollowRequest({
      userRepository,
      followRepository,
      followRequestRepository,
      createNotification: makeCreateNotification({ notificationRepository, clock }),
      clock,
    });
  });

  async function createUser(handle: string) {
    return userRepository.create({
      email: `${handle}@example.com`,
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle,
      displayName: handle,
    });
  }

  it('creates a new pending request (created: true)', async () => {
    const a = await createUser('alice');
    const b = await createUser('bob');

    const result = await sendFollowRequest({ requesterId: a.id, targetId: b.id });

    expect(result.created).toBe(true);
    expect(result.request).toEqual({ requesterId: a.id, targetId: b.id, createdAt: expect.any(String) });
    expect(await followRequestRepository.findByPair(a.id, b.id)).not.toBeNull();
  });

  it('is idempotent for a pending request to the same pair (created: false, RF-008)', async () => {
    const a = await createUser('alice');
    const b = await createUser('bob');

    const first = await sendFollowRequest({ requesterId: a.id, targetId: b.id });
    const second = await sendFollowRequest({ requesterId: a.id, targetId: b.id });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
  });

  it('notifies the target of a new pending request (008 scenario 1, RF-001)', async () => {
    const a = await createUser('alice');
    const b = await createUser('bob');

    await sendFollowRequest({ requesterId: a.id, targetId: b.id });

    expect(await notificationRepository.countUnread(b.id)).toBe(1);
  });

  it('does not duplicate the notification on a repeated pending request (008, D1)', async () => {
    const a = await createUser('alice');
    const b = await createUser('bob');

    await sendFollowRequest({ requesterId: a.id, targetId: b.id });
    await sendFollowRequest({ requesterId: a.id, targetId: b.id });

    expect(await notificationRepository.countUnread(b.id)).toBe(1);
  });

  it('rejects a request targeting yourself (RF-006)', async () => {
    const a = await createUser('alice');
    await expect(sendFollowRequest({ requesterId: a.id, targetId: a.id })).rejects.toBeInstanceOf(
      CannotFollowSelfError,
    );
  });

  it('rejects a request when the target does not exist', async () => {
    const a = await createUser('alice');
    await expect(
      sendFollowRequest({ requesterId: a.id, targetId: '507f1f77bcf86cd799439099' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects a request when the requester already follows the target (RF-007)', async () => {
    const a = await createUser('alice');
    const b = await createUser('bob');
    await followRepository.create(a.id, b.id, clock.now());

    await expect(sendFollowRequest({ requesterId: a.id, targetId: b.id })).rejects.toBeInstanceOf(
      AlreadyFollowingError,
    );
  });
});
