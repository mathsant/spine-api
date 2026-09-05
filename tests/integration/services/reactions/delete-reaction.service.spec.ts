import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ReactionNotFoundError } from '../../../../src/errors';
import { MongoActivityRepository } from '../../../../src/repositories/activities';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { MongoReactionRepository } from '../../../../src/repositories/reactions';
import { makeResolveVisibleActivity } from '../../../../src/services/activities';
import { makeDeleteReaction } from '../../../../src/services/reactions';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const owner = '507f1f77bcf86cd799439011';
const follower = '507f1f77bcf86cd799439012';
const bookId = '507f1f77bcf86cd799439021';
const sessionId = '507f1f77bcf86cd799439031';

describe('delete-reaction service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let activityRepository: MongoActivityRepository;
  let followRepository: MongoFollowRepository;
  let reactionRepository: MongoReactionRepository;
  let deleteReaction: ReturnType<typeof makeDeleteReaction>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('delete_reaction_service_test');
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(['activities', 'follows', 'reactions'].map((c) => db.collection(c).deleteMany({})));
    activityRepository = new MongoActivityRepository(db);
    followRepository = new MongoFollowRepository(db);
    reactionRepository = new MongoReactionRepository(db);
    const resolveVisibleActivity = makeResolveVisibleActivity({ activityRepository, followRepository });
    deleteReaction = makeDeleteReaction({ reactionRepository, resolveVisibleActivity });
  });

  it('removes an existing reaction (scenario 3, RF-003)', async () => {
    const activity = await activityRepository.record(
      { type: 'progress_update', actorId: owner, bookId, readingSessionId: sessionId, currentPage: 10 },
      new Date(),
    );
    await followRepository.create(follower, owner, new Date());
    await reactionRepository.add(activity.id, follower, sessionId, 'progress_update', new Date());

    await deleteReaction({ userId: follower, activityId: activity.id });

    const counts = await reactionRepository.countByActivityIds([activity.id]);
    expect(counts.get(activity.id)).toBeUndefined();
  });

  it('rejects when there is nothing to remove', async () => {
    const activity = await activityRepository.record(
      { type: 'progress_update', actorId: owner, bookId, readingSessionId: sessionId, currentPage: 10 },
      new Date(),
    );
    await followRepository.create(follower, owner, new Date());

    await expect(
      deleteReaction({ userId: follower, activityId: activity.id }),
    ).rejects.toBeInstanceOf(ReactionNotFoundError);
  });
});
