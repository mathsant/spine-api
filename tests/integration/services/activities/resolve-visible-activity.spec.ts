import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ActivityNotFoundError, UnsupportedActivityInteractionError } from '../../../../src/errors';
import { MongoActivityRepository } from '../../../../src/repositories/activities';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { makeResolveVisibleActivity } from '../../../../src/services/activities';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const owner = '507f1f77bcf86cd799439011';
const follower = '507f1f77bcf86cd799439012';
const stranger = '507f1f77bcf86cd799439013';
const bookId = '507f1f77bcf86cd799439021';
const sessionId = '507f1f77bcf86cd799439031';

describe('resolve-visible-activity service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let activityRepository: MongoActivityRepository;
  let followRepository: MongoFollowRepository;
  let resolveVisibleActivity: ReturnType<typeof makeResolveVisibleActivity>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('resolve_visible_activity_test');
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(['activities', 'follows'].map((c) => db.collection(c).deleteMany({})));
    activityRepository = new MongoActivityRepository(db);
    followRepository = new MongoFollowRepository(db);
    resolveVisibleActivity = makeResolveVisibleActivity({ activityRepository, followRepository });
  });

  it('resolves the activity when the viewer is its owner', async () => {
    const activity = await activityRepository.record(
      { type: 'progress_update', actorId: owner, bookId, readingSessionId: sessionId, currentPage: 10 },
      new Date(),
    );

    await expect(resolveVisibleActivity(activity.id, owner)).resolves.toEqual(activity);
  });

  it('resolves the activity when the viewer is an approved follower of the owner', async () => {
    const activity = await activityRepository.record(
      { type: 'review_published', actorId: owner, bookId, readingSessionId: sessionId },
      new Date(),
    );
    await followRepository.create(follower, owner, new Date());

    await expect(resolveVisibleActivity(activity.id, follower)).resolves.toEqual(activity);
  });

  it('rejects with ActivityNotFoundError when the viewer does not follow the owner (RF-012)', async () => {
    const activity = await activityRepository.record(
      { type: 'finished_reading', actorId: owner, bookId, readingSessionId: sessionId },
      new Date(),
    );

    await expect(resolveVisibleActivity(activity.id, stranger)).rejects.toBeInstanceOf(ActivityNotFoundError);
  });

  it('rejects with ActivityNotFoundError when the activityId does not exist (RF-015)', async () => {
    await expect(
      resolveVisibleActivity('507f1f77bcf86cd799439099', owner),
    ).rejects.toBeInstanceOf(ActivityNotFoundError);
  });

  it('rejects with UnsupportedActivityInteractionError for a started_reading activity, even for its owner (RF-011)', async () => {
    const activity = await activityRepository.record(
      { type: 'started_reading', actorId: owner, bookId, readingSessionId: sessionId },
      new Date(),
    );

    await expect(
      resolveVisibleActivity(activity.id, owner),
    ).rejects.toBeInstanceOf(UnsupportedActivityInteractionError);
  });
});
