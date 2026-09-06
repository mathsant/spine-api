import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ensureActivityIndexes } from '../../../helpers/activity-indexes';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

/**
 * RNF-001 (feature 011): the batch relationship queries and the single-actor activity
 * query must be served by an index — no collection scan as the base collections grow.
 */
describe('feature 011 query index usage (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('feature_011_index_usage_test');
    await ensureFollowIndexes(db);
    await ensureActivityIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      ['follows', 'follow_requests', 'activities'].map((c) => db.collection(c).deleteMany({})),
    );
  });

  function stageNames(plan: Record<string, unknown>): string[] {
    const names: string[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const record = node as Record<string, unknown>;
      if (typeof record.stage === 'string') names.push(record.stage);
      for (const value of Object.values(record)) {
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === 'object') walk(value);
      }
    };
    walk(plan);
    return names;
  }

  it('followsYou batch — { followeeId, followerId: { $in } } — uses IXSCAN, no COLLSCAN', async () => {
    const explain = await db
      .collection('follows')
      .find({ followeeId: 'me', followerId: { $in: ['a', 'b'] } })
      .explain('queryPlanner');
    const stages = stageNames(explain.queryPlanner.winningPlan);
    expect(stages).toContain('IXSCAN');
    expect(stages).not.toContain('COLLSCAN');
  });

  it('followState batch — { followerId, followeeId: { $in } } — uses IXSCAN, no COLLSCAN', async () => {
    const explain = await db
      .collection('follows')
      .find({ followerId: 'me', followeeId: { $in: ['a', 'b'] } })
      .explain('queryPlanner');
    const stages = stageNames(explain.queryPlanner.winningPlan);
    expect(stages).toContain('IXSCAN');
    expect(stages).not.toContain('COLLSCAN');
  });

  it('pending-request batch — { requesterId, targetId: { $in } } — uses IXSCAN, no COLLSCAN', async () => {
    const explain = await db
      .collection('follow_requests')
      .find({ requesterId: 'me', targetId: { $in: ['a', 'b'] } })
      .explain('queryPlanner');
    const stages = stageNames(explain.queryPlanner.winningPlan);
    expect(stages).toContain('IXSCAN');
    expect(stages).not.toContain('COLLSCAN');
  });

  it('single-actor activity — { actorId } sorted by createdAt — uses IXSCAN, no COLLSCAN', async () => {
    const explain = await db
      .collection('activities')
      .find({ actorId: { $in: ['target'] } })
      .sort({ createdAt: -1, _id: -1 })
      .explain('queryPlanner');
    const stages = stageNames(explain.queryPlanner.winningPlan);
    expect(stages).toContain('IXSCAN');
    expect(stages).not.toContain('COLLSCAN');
  });
});
