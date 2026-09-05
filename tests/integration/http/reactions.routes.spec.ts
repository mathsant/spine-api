import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { signAccessToken } from '../../../src/auth';
import { buildApp } from '../../../src/app';
import type { AppConfig } from '../../../src/config';
import { MongoActivityRepository } from '../../../src/repositories/activities';
import { MongoFollowRepository } from '../../../src/repositories/follows';
import { MongoUserRepository } from '../../../src/repositories/users';
import { ensureAuthIndexes } from '../../helpers/auth-indexes';
import { ensureFollowIndexes } from '../../helpers/follow-indexes';
import { testConfig } from '../../helpers/config';
import { type MongoMemory, startMongoMemory } from '../../helpers/mongo-memory';

const DB_NAME = 'reactions_routes_test';
const SECRET = testConfig().accessTokenSecret;
const bookId = '507f1f77bcf86cd799439021';

describe('reactions routes (integration)', () => {
  let mongo: MongoMemory;
  let apps: FastifyInstance[] = [];
  let ownerAuth: string;
  let followerAuth: string;
  let strangerAuth: string;
  let ownerId: string;
  let activityRepository: MongoActivityRepository;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    const db = mongo.client.db(DB_NAME);
    await ensureAuthIndexes(db);
    await ensureFollowIndexes(db);

    const users = new MongoUserRepository(db);
    const owner = await users.create({
      email: 'owner@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'owner',
      displayName: 'Owner',
    });
    const follower = await users.create({
      email: 'follower@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'follower',
      displayName: 'Follower',
    });
    const stranger = await users.create({
      email: 'stranger@example.com',
      passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
      handle: 'stranger',
      displayName: 'Stranger',
    });
    ownerId = owner.id;
    ownerAuth = `Bearer ${signAccessToken({ userId: owner.id }, SECRET)}`;
    followerAuth = `Bearer ${signAccessToken({ userId: follower.id }, SECRET)}`;
    strangerAuth = `Bearer ${signAccessToken({ userId: stranger.id }, SECRET)}`;

    const follows = new MongoFollowRepository(db);
    await follows.create(follower.id, owner.id, new Date());

    activityRepository = new MongoActivityRepository(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    const db = mongo.client.db(DB_NAME);
    await Promise.all(['activities', 'reactions'].map((c) => db.collection(c).deleteMany({})));
  });

  afterEach(async () => {
    await Promise.all(apps.map((a) => a.close()));
    apps = [];
  });

  async function build(overrides: Partial<AppConfig> = {}): Promise<FastifyInstance> {
    const app = await buildApp(testConfig({ mongoUri: mongo.uri, mongoDbName: DB_NAME, ...overrides }));
    apps.push(app);
    return app;
  }

  async function anActivity(type: 'progress_update' | 'started_reading' = 'progress_update') {
    const activity = await activityRepository.record(
      { type, actorId: ownerId, bookId, readingSessionId: 'session-1', currentPage: type === 'progress_update' ? 10 : undefined },
      new Date(),
    );
    return activity.id;
  }

  it('reacts (204), is idempotent, and rejects removing without a prior reaction', async () => {
    const app = await build();
    const activityId = await anActivity();

    const first = await app.inject({
      method: 'POST',
      url: `/v1/activities/${activityId}/reactions`,
      headers: { authorization: followerAuth },
    });
    expect(first.statusCode).toBe(204);

    const second = await app.inject({
      method: 'POST',
      url: `/v1/activities/${activityId}/reactions`,
      headers: { authorization: followerAuth },
    });
    expect(second.statusCode).toBe(204);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/v1/activities/${activityId}/reactions`,
      headers: { authorization: followerAuth },
    });
    expect(removed.statusCode).toBe(204);

    const removedAgain = await app.inject({
      method: 'DELETE',
      url: `/v1/activities/${activityId}/reactions`,
      headers: { authorization: followerAuth },
    });
    expect(removedAgain.statusCode).toBe(404);
    expect(removedAgain.json().error.code).toBe('REACTION_NOT_FOUND');
  });

  it('rejects without authentication (401)', async () => {
    const app = await build();
    const activityId = await anActivity();

    const res = await app.inject({ method: 'POST', url: `/v1/activities/${activityId}/reactions` });
    expect(res.statusCode).toBe(401);
  });

  it('reports a nonexistent or non-visible activity as 404 ACTIVITY_NOT_FOUND', async () => {
    const app = await build();
    const activityId = await anActivity();

    const ghost = await app.inject({
      method: 'POST',
      url: '/v1/activities/000000000000000000000000/reactions',
      headers: { authorization: followerAuth },
    });
    expect(ghost.statusCode).toBe(404);
    expect(ghost.json().error.code).toBe('ACTIVITY_NOT_FOUND');

    const stranger = await app.inject({
      method: 'POST',
      url: `/v1/activities/${activityId}/reactions`,
      headers: { authorization: strangerAuth },
    });
    expect(stranger.statusCode).toBe(404);
    expect(stranger.json().error.code).toBe('ACTIVITY_NOT_FOUND');
  });

  it('rejects a started_reading target with 422 UNSUPPORTED_ACTIVITY_INTERACTION', async () => {
    const app = await build();
    const activityId = await anActivity('started_reading');

    const res = await app.inject({
      method: 'POST',
      url: `/v1/activities/${activityId}/reactions`,
      headers: { authorization: ownerAuth },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('UNSUPPORTED_ACTIVITY_INTERACTION');
  });
});
