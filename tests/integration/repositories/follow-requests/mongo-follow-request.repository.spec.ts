import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoFollowRequestRepository } from '../../../../src/repositories/follow-requests';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('MongoFollowRequestRepository (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let repo: MongoFollowRequestRepository;

  const requesterId = '507f1f77bcf86cd799439011';
  const targetId = '507f1f77bcf86cd799439012';
  const otherId = '507f1f77bcf86cd799439013';

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('follow_request_repo_test');
    await ensureFollowIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('follow_requests').deleteMany({});
    repo = new MongoFollowRequestRepository(db);
  });

  it('creates a pending request', async () => {
    const record = await repo.create(requesterId, targetId, new Date());
    expect(record).toMatchObject({ requesterId, targetId });
    expect(typeof record.id).toBe('string');
    expect(record.createdAt).toBeInstanceOf(Date);
  });

  it('create is idempotent — a second create for the same pair returns the existing request instead of throwing', async () => {
    const first = await repo.create(requesterId, targetId, new Date());
    const second = await repo.create(requesterId, targetId, new Date());
    expect(second.id).toBe(first.id);
  });

  it('findByPair finds and returns null when absent', async () => {
    const created = await repo.create(requesterId, targetId, new Date());
    expect(await repo.findByPair(requesterId, targetId)).toMatchObject({ id: created.id });
    expect(await repo.findByPair(requesterId, otherId)).toBeNull();
  });

  it('deleteByPair removes and returns the deleted record, null if absent', async () => {
    const created = await repo.create(requesterId, targetId, new Date());
    const deleted = await repo.deleteByPair(requesterId, targetId);
    expect(deleted?.id).toBe(created.id);
    expect(await repo.findByPair(requesterId, targetId)).toBeNull();
    expect(await repo.deleteByPair(requesterId, targetId)).toBeNull();
  });

  it('listByTarget/listByRequester paginate by cursor (createdAt desc)', async () => {
    const now = Date.now();
    await repo.create(requesterId, targetId, new Date(now));
    await repo.create(otherId, targetId, new Date(now + 1000));

    const incoming = await repo.listByTarget(targetId, null, 20);
    expect(incoming.items).toHaveLength(2);
    expect(incoming.items[0].requesterId).toBe(otherId);
    expect(incoming.items[1].requesterId).toBe(requesterId);
    expect(incoming.nextCursor).toBeNull();

    const outgoing = await repo.listByRequester(requesterId, null, 20);
    expect(outgoing.items).toHaveLength(1);
    expect(outgoing.items[0].targetId).toBe(targetId);
  });

  it('filterPendingTargets returns the subset of candidateIds requesterId has a pending request to; [] for empty input', async () => {
    await repo.create(requesterId, targetId, new Date());

    expect(await repo.filterPendingTargets(requesterId, [])).toEqual([]);
    expect(await repo.filterPendingTargets(requesterId, [targetId, otherId])).toEqual([targetId]);
    expect(await repo.filterPendingTargets(otherId, [targetId])).toEqual([]);
  });

  it('countIncoming counts pending requests received by userId', async () => {
    await repo.create(requesterId, targetId, new Date());
    await repo.create(otherId, targetId, new Date());
    await repo.create(requesterId, otherId, new Date());

    expect(await repo.countIncoming(targetId)).toBe(2);
    expect(await repo.countIncoming(otherId)).toBe(1);
    expect(await repo.countIncoming(requesterId)).toBe(0);
  });
});
