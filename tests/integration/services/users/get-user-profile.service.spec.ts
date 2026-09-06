import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { UserNotFoundError } from '../../../../src/errors';
import { MongoFollowRequestRepository } from '../../../../src/repositories/follow-requests';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { MongoUserRepository } from '../../../../src/repositories/users';
import { makeGetUserProfile } from '../../../../src/services/users';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('get-user-profile service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let userRepository: MongoUserRepository;
  let followRepository: MongoFollowRepository;
  let followRequestRepository: MongoFollowRequestRepository;
  let getUserProfile: ReturnType<typeof makeGetUserProfile>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('get_user_profile_service_test');
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
    getUserProfile = makeGetUserProfile({
      userRepository,
      followRepository,
      followRequestRepository,
    });
  });

  async function createUser(handle: string, bio: string | null = null) {
    const user = await userRepository.create({
      email: `${handle}@example.com`,
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle,
      displayName: handle.toUpperCase(),
    });
    if (bio !== null) {
      await userRepository.updateProfile(user.id, { bio }, new Date());
    }
    return user;
  }

  it('returns identity always and bio only for an approved follower (scenario 2)', async () => {
    const viewer = await createUser('viewer');
    const target = await createUser('target', 'my private bio');
    await followRepository.create(viewer.id, target.id, new Date());

    const profile = await getUserProfile({ viewerId: viewer.id, userId: target.id });

    expect(profile).toEqual({
      id: target.id,
      handle: 'target',
      displayName: 'TARGET',
      avatarUrl: null,
      bio: 'my private bio',
      followState: 'following',
      followsYou: false,
    });
  });

  it('hides bio (null) when the viewer does not follow the target (scenario 1)', async () => {
    const viewer = await createUser('viewer');
    const target = await createUser('target', 'my private bio');

    const profile = await getUserProfile({ viewerId: viewer.id, userId: target.id });

    expect(profile).toMatchObject({ bio: null, followState: 'none', followsYou: false });
  });

  it('reports followState pending and hides bio when a request is pending (scenario 3)', async () => {
    const viewer = await createUser('viewer');
    const target = await createUser('target', 'my private bio');
    await followRequestRepository.create(viewer.id, target.id, new Date());

    const profile = await getUserProfile({ viewerId: viewer.id, userId: target.id });

    expect(profile).toMatchObject({ bio: null, followState: 'pending' });
  });

  it('reports followsYou true when the target follows the viewer, still hiding bio (scenario 4)', async () => {
    const viewer = await createUser('viewer');
    const target = await createUser('target', 'my private bio');
    await followRepository.create(target.id, viewer.id, new Date());

    const profile = await getUserProfile({ viewerId: viewer.id, userId: target.id });

    expect(profile).toMatchObject({ bio: null, followState: 'none', followsYou: true });
  });

  it('allows viewing own profile: followState none, followsYou false, bio null (scenario 5)', async () => {
    const me = await createUser('me', 'my own bio');

    const profile = await getUserProfile({ viewerId: me.id, userId: me.id });

    expect(profile).toMatchObject({
      id: me.id,
      handle: 'me',
      followState: 'none',
      followsYou: false,
      bio: null,
    });
  });

  it('throws the same UserNotFoundError for a nonexistent id and a malformed id (scenario 6)', async () => {
    const viewer = await createUser('viewer');

    await expect(
      getUserProfile({ viewerId: viewer.id, userId: '507f1f77bcf86cd799439099' }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
    await expect(
      getUserProfile({ viewerId: viewer.id, userId: 'not-an-id' }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('treats a rejected (deleted) request as followState none (scenario 7)', async () => {
    const viewer = await createUser('viewer');
    const target = await createUser('target');
    await followRequestRepository.create(viewer.id, target.id, new Date());
    await followRequestRepository.deleteByPair(viewer.id, target.id);

    const profile = await getUserProfile({ viewerId: viewer.id, userId: target.id });

    expect(profile.followState).toBe('none');
  });

  it('never includes counters', async () => {
    const viewer = await createUser('viewer');
    const target = await createUser('target');

    const profile = await getUserProfile({ viewerId: viewer.id, userId: target.id });

    expect(Object.keys(profile).sort()).toEqual(
      ['avatarUrl', 'bio', 'displayName', 'followState', 'followsYou', 'handle', 'id'].sort(),
    );
  });
});
