import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoFollowRequestRepository } from '../../../../src/repositories/follow-requests';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { MongoUserRepository } from '../../../../src/repositories/users';
import { makeListFollowRequests } from '../../../../src/services/follows';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('list-follow-requests service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let userRepository: MongoUserRepository;
  let followRequestRepository: MongoFollowRequestRepository;
  let followRepository: MongoFollowRepository;
  let listFollowRequests: ReturnType<typeof makeListFollowRequests>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('list_follow_requests_service_test');
    await ensureAuthIndexes(db);
    await ensureFollowIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      ['users', 'follow_requests', 'follows'].map((c) => db.collection(c).deleteMany({})),
    );
    userRepository = new MongoUserRepository(db);
    followRequestRepository = new MongoFollowRequestRepository(db);
    followRepository = new MongoFollowRepository(db);
    listFollowRequests = makeListFollowRequests({
      followRequestRepository,
      followRepository,
      userRepository,
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

  it('direction incoming lists requests received; outgoing lists requests sent', async () => {
    const a = await createUser('alice');
    const b = await createUser('bob');
    await followRequestRepository.create(a.id, b.id, new Date());

    const incoming = await listFollowRequests({
      userId: b.id,
      direction: 'incoming',
      cursor: null,
      limit: 20,
    });
    expect(incoming.items).toHaveLength(1);
    expect(incoming.items[0]).toMatchObject({
      userId: a.id,
      handle: 'alice',
      displayName: 'alice',
      direction: 'incoming',
    });

    const outgoing = await listFollowRequests({
      userId: a.id,
      direction: 'outgoing',
      cursor: null,
      limit: 20,
    });
    expect(outgoing.items).toHaveLength(1);
    expect(outgoing.items[0]).toMatchObject({ userId: b.id, handle: 'bob', direction: 'outgoing' });
  });

  it('paginates by cursor', async () => {
    const a = await createUser('alice');
    const b = await createUser('bob');
    const c = await createUser('carol');
    await followRequestRepository.create(b.id, a.id, new Date(2025, 0, 1));
    await followRequestRepository.create(c.id, a.id, new Date(2025, 0, 2));

    const page = await listFollowRequests({ userId: a.id, direction: 'incoming', cursor: null, limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).not.toBeNull();

    const nextPage = await listFollowRequests({
      userId: a.id,
      direction: 'incoming',
      cursor: page.nextCursor,
      limit: 1,
    });
    expect(nextPage.items).toHaveLength(1);
    expect(nextPage.items[0].userId).not.toBe(page.items[0].userId);
  });

  it('incoming: followsYou is false until approved, followState reflects my real state (scenario 25)', async () => {
    const me = await createUser('me');
    const asker = await createUser('asker');
    await followRequestRepository.create(asker.id, me.id, new Date());
    await followRepository.create(me.id, asker.id, new Date()); // I already follow the asker

    const incoming = await listFollowRequests({
      userId: me.id,
      direction: 'incoming',
      cursor: null,
      limit: 20,
    });

    expect(incoming.items[0]).toMatchObject({ followState: 'following', followsYou: false });
  });

  it('outgoing: followState is always pending (scenario 26)', async () => {
    const me = await createUser('me');
    const target = await createUser('target');
    await followRequestRepository.create(me.id, target.id, new Date());
    await followRepository.create(target.id, me.id, new Date()); // target follows me

    const outgoing = await listFollowRequests({
      userId: me.id,
      direction: 'outgoing',
      cursor: null,
      limit: 20,
    });

    expect(outgoing.items[0]).toMatchObject({ followState: 'pending', followsYou: true });
  });
});
