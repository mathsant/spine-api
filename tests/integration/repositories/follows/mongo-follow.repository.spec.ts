import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('MongoFollowRepository (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let repo: MongoFollowRepository;

  const followerId = '507f1f77bcf86cd799439011';
  const followeeId = '507f1f77bcf86cd799439012';
  const otherId = '507f1f77bcf86cd799439013';

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('follow_repo_test');
    await ensureFollowIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('follows').deleteMany({});
    repo = new MongoFollowRepository(db);
  });

  it('creates a follow relation', async () => {
    const record = await repo.create(followerId, followeeId, new Date());
    expect(record).toMatchObject({ followerId, followeeId });
    expect(typeof record.id).toBe('string');
  });

  it('exists returns true/false', async () => {
    await repo.create(followerId, followeeId, new Date());
    expect(await repo.exists(followerId, followeeId)).toBe(true);
    expect(await repo.exists(followeeId, followerId)).toBe(false);
    expect(await repo.exists(followerId, otherId)).toBe(false);
  });

  it('deleteByPair removes and returns the deleted record, null if absent', async () => {
    const created = await repo.create(followerId, followeeId, new Date());
    const deleted = await repo.deleteByPair(followerId, followeeId);
    expect(deleted?.id).toBe(created.id);
    expect(await repo.exists(followerId, followeeId)).toBe(false);
    expect(await repo.deleteByPair(followerId, followeeId)).toBeNull();
  });

  it('listByFollowee/listByFollower paginate by cursor (createdAt desc)', async () => {
    const now = Date.now();
    await repo.create(followerId, followeeId, new Date(now));
    await repo.create(otherId, followeeId, new Date(now + 1000));

    const followers = await repo.listByFollowee(followeeId, null, 20);
    expect(followers.items).toHaveLength(2);
    expect(followers.items[0].followerId).toBe(otherId);
    expect(followers.items[1].followerId).toBe(followerId);
    expect(followers.nextCursor).toBeNull();

    const following = await repo.listByFollower(followerId, null, 20);
    expect(following.items).toHaveLength(1);
    expect(following.items[0].followeeId).toBe(followeeId);
  });

  it('listFolloweeIds returns all followee ids, unpaginated, [] if none', async () => {
    expect(await repo.listFolloweeIds(followerId)).toEqual([]);

    await repo.create(followerId, followeeId, new Date());
    await repo.create(followerId, otherId, new Date());

    const ids = await repo.listFolloweeIds(followerId);
    expect(ids.sort()).toEqual([followeeId, otherId].sort());
  });

  it('filterFollowing returns the subset of candidateIds followerId approved-follows; [] for empty input', async () => {
    await repo.create(followerId, followeeId, new Date());

    expect(await repo.filterFollowing(followerId, [])).toEqual([]);
    expect(await repo.filterFollowing(followerId, [followeeId, otherId])).toEqual([followeeId]);
    expect(await repo.filterFollowing(otherId, [followeeId])).toEqual([]);
  });

  it('filterFollowers returns the subset of candidateIds that approved-follow followeeId; [] for empty input', async () => {
    await repo.create(followerId, followeeId, new Date());
    await repo.create(otherId, followeeId, new Date());

    expect(await repo.filterFollowers(followeeId, [])).toEqual([]);
    expect((await repo.filterFollowers(followeeId, [followerId, otherId])).sort()).toEqual(
      [followerId, otherId].sort(),
    );
    expect(await repo.filterFollowers(followerId, [otherId])).toEqual([]);
  });

  it('countFollowers / countFollowing count approved follows in each direction', async () => {
    await repo.create(followerId, followeeId, new Date());
    await repo.create(otherId, followeeId, new Date());
    await repo.create(followerId, otherId, new Date());

    expect(await repo.countFollowers(followeeId)).toBe(2);
    expect(await repo.countFollowing(followerId)).toBe(2);
    expect(await repo.countFollowers(followerId)).toBe(0);
  });

  // --- follow-suggestion aggregations (012) ---

  const a = '507f1f77bcf86cd799439021';
  const b = '507f1f77bcf86cd799439022';
  const carla = '507f1f77bcf86cd799439023';
  const dora = '507f1f77bcf86cd799439024';

  it('listFollowSuggestionCandidates counts distinct in-network followers per candidate; [] for empty input', async () => {
    // a and b both follow carla; only a follows dora
    await repo.create(a, carla, new Date());
    await repo.create(b, carla, new Date());
    await repo.create(a, dora, new Date());

    expect(await repo.listFollowSuggestionCandidates([])).toEqual([]);

    const candidates = await repo.listFollowSuggestionCandidates([a, b]);
    const byUser = new Map(candidates.map((c) => [c.userId, c.mutualFollowersCount]));
    expect(byUser.get(carla)).toBe(2);
    expect(byUser.get(dora)).toBe(1);
    expect(candidates).toHaveLength(2);
  });

  it('countFollowersByUser returns a Map of approved-follower counts; empty Map for empty input', async () => {
    await repo.create(a, carla, new Date());
    await repo.create(b, carla, new Date());
    await repo.create(a, dora, new Date());

    expect(await repo.countFollowersByUser([])).toEqual(new Map());

    const counts = await repo.countFollowersByUser([carla, dora, b]);
    expect(counts.get(carla)).toBe(2);
    expect(counts.get(dora)).toBe(1);
    expect(counts.has(b)).toBe(false);
  });

  it('listMostFollowedUsers ranks by follower count desc, applies limit and excludes ids', async () => {
    // carla: 3 followers, dora: 2, b: 1
    await repo.create(a, carla, new Date());
    await repo.create(b, carla, new Date());
    await repo.create(dora, carla, new Date());
    await repo.create(a, dora, new Date());
    await repo.create(b, dora, new Date());
    await repo.create(a, b, new Date());

    expect(await repo.listMostFollowedUsers(10, [])).toEqual([carla, dora, b]);
    expect(await repo.listMostFollowedUsers(2, [])).toEqual([carla, dora]);
    expect(await repo.listMostFollowedUsers(10, [carla])).toEqual([dora, b]);
  });

  it('the suggestion aggregations run on an index (no COLLSCAN)', async () => {
    await repo.create(a, carla, new Date());
    await repo.create(b, carla, new Date());

    const plans = await Promise.all([
      db
        .collection('follows')
        .aggregate(
          [
            { $match: { followerId: { $in: [a, b] } } },
            { $group: { _id: '$followeeId', n: { $sum: 1 } } },
          ],
          { hint: 'follows_followerId_followeeId_unique' },
        )
        .explain(),
      db
        .collection('follows')
        .aggregate(
          [
            { $match: { followeeId: { $in: [carla] } } },
            { $group: { _id: '$followeeId', n: { $sum: 1 } } },
          ],
          { hint: 'follows_followeeId_followerId' },
        )
        .explain(),
      db
        .collection('follows')
        .aggregate(
          [
            { $match: { followeeId: { $nin: [a] } } },
            { $group: { _id: '$followeeId', n: { $sum: 1 } } },
          ],
          { hint: 'follows_followeeId_followerId' },
        )
        .explain(),
    ]);

    for (const plan of plans) {
      const serialized = JSON.stringify(plan);
      expect(serialized).not.toContain('COLLSCAN');
      expect(serialized).toContain('IXSCAN');
    }
  });
});
