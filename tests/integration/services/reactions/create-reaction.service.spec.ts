import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ActivityNotFoundError, UnsupportedActivityInteractionError } from '../../../../src/errors';
import { MongoActivityRepository } from '../../../../src/repositories/activities';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { MongoReactionRepository } from '../../../../src/repositories/reactions';
import { makeResolveVisibleActivity } from '../../../../src/services/activities';
import { makeCreateReaction } from '../../../../src/services/reactions';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const owner = '507f1f77bcf86cd799439011';
const follower = '507f1f77bcf86cd799439012';
const stranger = '507f1f77bcf86cd799439013';
const bookId = '507f1f77bcf86cd799439021';
const sessionId = '507f1f77bcf86cd799439031';

describe('create-reaction service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let activityRepository: MongoActivityRepository;
  let followRepository: MongoFollowRepository;
  let reactionRepository: MongoReactionRepository;
  let createReaction: ReturnType<typeof makeCreateReaction>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('create_reaction_service_test');
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
    createReaction = makeCreateReaction({ reactionRepository, resolveVisibleActivity, clock: { now: () => new Date() } });
  });

  it('reacts to a followed user\'s item (scenario 1, RF-001)', async () => {
    const activity = await activityRepository.record(
      { type: 'progress_update', actorId: owner, bookId, readingSessionId: sessionId, currentPage: 10 },
      new Date(),
    );
    await followRepository.create(follower, owner, new Date());

    await createReaction({ userId: follower, activityId: activity.id });

    const counts = await reactionRepository.countByActivityIds([activity.id]);
    expect(counts.get(activity.id)).toBe(1);
  });

  it('is idempotent — reacting twice does not duplicate (scenario 2, RF-002)', async () => {
    const activity = await activityRepository.record(
      { type: 'finished_reading', actorId: owner, bookId, readingSessionId: sessionId },
      new Date(),
    );
    await followRepository.create(follower, owner, new Date());

    await createReaction({ userId: follower, activityId: activity.id });
    await createReaction({ userId: follower, activityId: activity.id });

    const counts = await reactionRepository.countByActivityIds([activity.id]);
    expect(counts.get(activity.id)).toBe(1);
  });

  it('allows the owner to react to their own item (scenario 8, RF-014)', async () => {
    const activity = await activityRepository.record(
      { type: 'review_published', actorId: owner, bookId, readingSessionId: sessionId },
      new Date(),
    );

    await createReaction({ userId: owner, activityId: activity.id });

    const counts = await reactionRepository.countByActivityIds([activity.id]);
    expect(counts.get(activity.id)).toBe(1);
  });

  it('rejects a non-follower (scenario 9, RF-012)', async () => {
    const activity = await activityRepository.record(
      { type: 'progress_update', actorId: owner, bookId, readingSessionId: sessionId, currentPage: 5 },
      new Date(),
    );

    await expect(
      createReaction({ userId: stranger, activityId: activity.id }),
    ).rejects.toBeInstanceOf(ActivityNotFoundError);
  });

  it('rejects a started_reading target (scenario 11, RF-011)', async () => {
    const activity = await activityRepository.record(
      { type: 'started_reading', actorId: owner, bookId, readingSessionId: sessionId },
      new Date(),
    );

    await expect(
      createReaction({ userId: owner, activityId: activity.id }),
    ).rejects.toBeInstanceOf(UnsupportedActivityInteractionError);
  });
});
