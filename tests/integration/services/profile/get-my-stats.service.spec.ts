import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoFollowRequestRepository } from '../../../../src/repositories/follow-requests';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { MongoReadingSessionRepository } from '../../../../src/repositories/reading-sessions';
import { MongoShelfMembershipRepository } from '../../../../src/repositories/shelf-memberships';
import { makeGetMyStats } from '../../../../src/services/profile';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('get-my-stats service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let readingSessionRepository: MongoReadingSessionRepository;
  let followRepository: MongoFollowRepository;
  let followRequestRepository: MongoFollowRequestRepository;
  let shelfMembershipRepository: MongoShelfMembershipRepository;
  let getMyStats: ReturnType<typeof makeGetMyStats>;

  const me = '507f1f77bcf86cd799439011';
  const a = '507f1f77bcf86cd799439021';
  const b = '507f1f77bcf86cd799439022';
  const c = '507f1f77bcf86cd799439023';

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('get_my_stats_service_test');
    await ensureFollowIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      ['reading_sessions', 'follows', 'follow_requests', 'shelf_memberships'].map((coll) =>
        db.collection(coll).deleteMany({}),
      ),
    );
    readingSessionRepository = new MongoReadingSessionRepository(db);
    followRepository = new MongoFollowRepository(db);
    followRequestRepository = new MongoFollowRequestRepository(db);
    shelfMembershipRepository = new MongoShelfMembershipRepository(db);
    getMyStats = makeGetMyStats({
      readingSessionRepository,
      followRepository,
      followRequestRepository,
      shelfMembershipRepository,
    });
  });

  it('returns all counters at 0 for a brand-new user (scenario 20)', async () => {
    expect(await getMyStats({ userId: me })).toEqual({
      booksRead: 0,
      followers: 0,
      following: 0,
      pendingFollowRequests: 0,
      wantToRead: 0,
    });
  });

  it('computes each counter and counts a reread book once (scenarios 16, 17, 19)', async () => {
    // booksRead: two distinct finished books; one is a reread
    await readingSessionRepository.createFinished(me, 'book-x', { startedAt: null, finishedAt: new Date() });
    await readingSessionRepository.createFinished(me, 'book-x', { startedAt: null, finishedAt: new Date() });
    await readingSessionRepository.createFinished(me, 'book-y', { startedAt: null, finishedAt: new Date() });

    // following: me -> a, me -> b ; followers: c -> me
    await followRepository.create(me, a, new Date());
    await followRepository.create(me, b, new Date());
    await followRepository.create(c, me, new Date());

    // pendingFollowRequests: a -> me, b -> me (received); me -> c (sent, must NOT count)
    await followRequestRepository.create(a, me, new Date());
    await followRequestRepository.create(b, me, new Date());
    await followRequestRepository.create(me, c, new Date());

    // wantToRead: 2 marks
    await shelfMembershipRepository.add(me, 'book-w1');
    await shelfMembershipRepository.add(me, 'book-w2');

    expect(await getMyStats({ userId: me })).toEqual({
      booksRead: 2,
      followers: 1,
      following: 2,
      pendingFollowRequests: 2,
      wantToRead: 2,
    });
  });

  it('booksRead is 0 when the user has only reading (unfinished) sessions (scenario 18)', async () => {
    await readingSessionRepository.startReading(me, 'book-x', new Date());
    expect((await getMyStats({ userId: me })).booksRead).toBe(0);
  });
});
