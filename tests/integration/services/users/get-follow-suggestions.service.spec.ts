import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoFollowRequestRepository } from '../../../../src/repositories/follow-requests';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { MongoUserRepository } from '../../../../src/repositories/users';
import { makeGetFollowSuggestions } from '../../../../src/services/users';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('get-follow-suggestions service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let userRepository: MongoUserRepository;
  let followRepository: MongoFollowRepository;
  let followRequestRepository: MongoFollowRequestRepository;
  let getFollowSuggestions: ReturnType<typeof makeGetFollowSuggestions>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('get_follow_suggestions_service_test');
    await ensureAuthIndexes(db);
    await ensureFollowIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      ['users', 'follows', 'follow_requests'].map((c) => db.collection(c).deleteMany({})),
    );
    userRepository = new MongoUserRepository(db);
    followRepository = new MongoFollowRepository(db);
    followRequestRepository = new MongoFollowRequestRepository(db);
    getFollowSuggestions = makeGetFollowSuggestions({
      userRepository,
      followRepository,
      followRequestRepository,
    });
  });

  async function aUser(handle: string) {
    return userRepository.create({
      email: `${handle}@example.com`,
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle,
      displayName: handle,
    });
  }

  const follow = (followerId: string, followeeId: string) =>
    followRepository.create(followerId, followeeId, new Date());

  it('ranks candidates by mutualFollowersCount desc and never includes the viewer', async () => {
    const viewer = await aUser('viewer');
    const f1 = await aUser('f1');
    const f2 = await aUser('f2');
    const near = await aUser('near'); // followed by f1 and f2
    const far = await aUser('far'); // followed by f1 only

    await follow(viewer.id, f1.id);
    await follow(viewer.id, f2.id);
    await follow(f1.id, near.id);
    await follow(f2.id, near.id);
    await follow(f1.id, far.id);
    await follow(f1.id, viewer.id); // viewer is a followee of f1 — must still be excluded

    const { items } = await getFollowSuggestions({ viewerId: viewer.id });

    expect(items.map((i) => i.id)).toEqual([near.id, far.id]);
    expect(items[0].mutualFollowersCount).toBe(2);
    expect(items[1].mutualFollowersCount).toBe(1);
    expect(items.some((i) => i.id === viewer.id)).toBe(false);
    expect(items[0]).toMatchObject({ avatarUrl: null, followState: 'none' });
  });

  it('breaks a mutualFollowersCount tie by total approved-follower count desc', async () => {
    const viewer = await aUser('viewer');
    const f1 = await aUser('f1');
    const f2 = await aUser('f2');
    const popular = await aUser('popular');
    const quiet = await aUser('quiet');
    const e1 = await aUser('e1');
    const e2 = await aUser('e2');

    await follow(viewer.id, f1.id);
    await follow(viewer.id, f2.id);
    // both get mutualFollowersCount 2
    await follow(f1.id, popular.id);
    await follow(f2.id, popular.id);
    await follow(f1.id, quiet.id);
    await follow(f2.id, quiet.id);
    // popular has extra followers outside the viewer's network
    await follow(e1.id, popular.id);
    await follow(e2.id, popular.id);

    const { items } = await getFollowSuggestions({ viewerId: viewer.id });

    expect(items.map((i) => i.id)).toEqual([popular.id, quiet.id]);
  });

  it('breaks a further tie by createdAt desc (most recently joined first)', async () => {
    const viewer = await aUser('viewer');
    const f1 = await aUser('f1');
    const f2 = await aUser('f2');
    const older = await aUser('older');
    const newer = await aUser('newer'); // created after `older`

    await follow(viewer.id, f1.id);
    await follow(viewer.id, f2.id);
    for (const c of [older, newer]) {
      await follow(f1.id, c.id);
      await follow(f2.id, c.id);
    }

    const { items } = await getFollowSuggestions({ viewerId: viewer.id });

    expect(items.map((i) => i.id)).toEqual([newer.id, older.id]);
  });

  it('caps the list at 4 items', async () => {
    const viewer = await aUser('viewer');
    const f1 = await aUser('f1');
    await follow(viewer.id, f1.id);

    for (let i = 0; i < 6; i++) {
      const c = await aUser(`c${i}`);
      await follow(f1.id, c.id);
    }

    const { items } = await getFollowSuggestions({ viewerId: viewer.id });

    expect(items).toHaveLength(4);
    expect(items.every((i) => i.mutualFollowersCount === 1)).toBe(true);
  });

  it('cold start: with no follows, falls back to global popularity with mutualFollowersCount 0', async () => {
    const viewer = await aUser('viewer');
    const p1 = await aUser('p1');
    const p2 = await aUser('p2');
    const p3 = await aUser('p3');
    const a = await aUser('a');
    const b = await aUser('b');
    const c = await aUser('c');

    await follow(a.id, p1.id);
    await follow(b.id, p1.id);
    await follow(c.id, p1.id); // p1: 3 followers
    await follow(a.id, p2.id);
    await follow(b.id, p2.id); // p2: 2
    await follow(a.id, p3.id); // p3: 1

    const { items } = await getFollowSuggestions({ viewerId: viewer.id });

    expect(items.map((i) => i.id)).toEqual([p1.id, p2.id, p3.id]);
    expect(items.every((i) => i.mutualFollowersCount === 0)).toBe(true);
    expect(items.some((i) => i.id === viewer.id)).toBe(false);
  });

  it('returns an empty list (no popularity fallback) when the viewer follows someone but the network yields nobody new', async () => {
    const viewer = await aUser('viewer');
    const f1 = await aUser('f1');
    const already = await aUser('already');
    const popular = await aUser('popular');
    const x = await aUser('x');

    await follow(viewer.id, f1.id);
    await follow(viewer.id, already.id);
    // everything f1 follows is either the viewer or someone the viewer already follows
    await follow(f1.id, viewer.id);
    await follow(f1.id, already.id);
    // a globally popular account exists but must NOT be pulled in
    await follow(x.id, popular.id);

    const { items } = await getFollowSuggestions({ viewerId: viewer.id });

    expect(items).toEqual([]);
  });

  it('sets followsYou true for a candidate who already follows the viewer', async () => {
    const viewer = await aUser('viewer');
    const f1 = await aUser('f1');
    const fan = await aUser('fan');

    await follow(viewer.id, f1.id);
    await follow(f1.id, fan.id);
    await follow(fan.id, viewer.id);

    const { items } = await getFollowSuggestions({ viewerId: viewer.id });

    const fanItem = items.find((i) => i.id === fan.id);
    expect(fanItem).toMatchObject({ followsYou: true, followState: 'none' });
  });

  it('excludes a candidate the viewer has a pending follow-request to', async () => {
    const viewer = await aUser('viewer');
    const f1 = await aUser('f1');
    const pendingTarget = await aUser('pendingTarget');
    const open = await aUser('open');

    await follow(viewer.id, f1.id);
    await follow(f1.id, pendingTarget.id);
    await follow(f1.id, open.id);
    await followRequestRepository.create(viewer.id, pendingTarget.id, new Date());

    const { items } = await getFollowSuggestions({ viewerId: viewer.id });

    expect(items.map((i) => i.id)).toEqual([open.id]);
  });

  it('does not exclude a candidate whose earlier follow-request was declined (no record left)', async () => {
    const viewer = await aUser('viewer');
    const f1 = await aUser('f1');
    const declinedMe = await aUser('declinedMe');

    await follow(viewer.id, f1.id);
    await follow(f1.id, declinedMe.id);
    // request sent then rejected -> the row is deleted, like the reject flow does
    await followRequestRepository.create(viewer.id, declinedMe.id, new Date());
    await followRequestRepository.deleteByPair(viewer.id, declinedMe.id);

    const { items } = await getFollowSuggestions({ viewerId: viewer.id });

    expect(items.map((i) => i.id)).toEqual([declinedMe.id]);
  });
});
