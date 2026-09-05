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

const DB_NAME = 'comments_routes_test';
const SECRET = testConfig().accessTokenSecret;
const bookId = '507f1f77bcf86cd799439021';

describe('comments routes (integration)', () => {
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
    await Promise.all(['activities', 'comments'].map((c) => db.collection(c).deleteMany({})));
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

  it('creates a top-level comment (201) and lists it (200)', async () => {
    const app = await build();
    const activityId = await anActivity();

    const created = await app.inject({
      method: 'POST',
      url: `/v1/activities/${activityId}/comments`,
      headers: { authorization: followerAuth },
      payload: { text: 'Boa!' },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ text: 'Boa!', parentCommentId: null, deleted: false });

    const listed = await app.inject({
      method: 'GET',
      url: `/v1/activities/${activityId}/comments`,
      headers: { authorization: followerAuth },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().items).toHaveLength(1);
  });

  it('rejects an empty text with 400 VALIDATION_ERROR', async () => {
    const app = await build();
    const activityId = await anActivity();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/activities/${activityId}/comments`,
      headers: { authorization: followerAuth },
      payload: { text: '' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a reply to a reply with 422 COMMENT_NESTING_TOO_DEEP', async () => {
    const app = await build();
    const activityId = await anActivity();

    const top = await app.inject({
      method: 'POST',
      url: `/v1/activities/${activityId}/comments`,
      headers: { authorization: followerAuth },
      payload: { text: 'first' },
    });
    const topId = top.json().id as string;

    const reply = await app.inject({
      method: 'POST',
      url: `/v1/activities/${activityId}/comments`,
      headers: { authorization: ownerAuth },
      payload: { text: 'reply', parentCommentId: topId },
    });
    const replyId = reply.json().id as string;

    const tooDeep = await app.inject({
      method: 'POST',
      url: `/v1/activities/${activityId}/comments`,
      headers: { authorization: followerAuth },
      payload: { text: 'too deep', parentCommentId: replyId },
    });
    expect(tooDeep.statusCode).toBe(422);
    expect(tooDeep.json().error.code).toBe('COMMENT_NESTING_TOO_DEEP');
  });

  it('soft-deletes the caller\'s own comment (204) and shows the placeholder afterwards', async () => {
    const app = await build();
    const activityId = await anActivity();

    const created = await app.inject({
      method: 'POST',
      url: `/v1/activities/${activityId}/comments`,
      headers: { authorization: followerAuth },
      payload: { text: 'oops' },
    });
    const commentId = created.json().id as string;

    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/comments/${commentId}`,
      headers: { authorization: followerAuth },
    });
    expect(del.statusCode).toBe(204);

    const listed = await app.inject({
      method: 'GET',
      url: `/v1/activities/${activityId}/comments`,
      headers: { authorization: followerAuth },
    });
    expect(listed.json().items[0]).toMatchObject({ text: '[removido]', deleted: true });
  });

  it('rejects deleting someone else\'s comment as 404 COMMENT_NOT_FOUND', async () => {
    const app = await build();
    const activityId = await anActivity();

    const created = await app.inject({
      method: 'POST',
      url: `/v1/activities/${activityId}/comments`,
      headers: { authorization: followerAuth },
      payload: { text: 'mine' },
    });
    const commentId = created.json().id as string;

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/comments/${commentId}`,
      headers: { authorization: ownerAuth },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('COMMENT_NOT_FOUND');
  });

  it('rejects without authentication (401)', async () => {
    const app = await build();
    const activityId = await anActivity();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/activities/${activityId}/comments`,
      payload: { text: 'hi' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('reports a non-visible activity as 404 ACTIVITY_NOT_FOUND', async () => {
    const app = await build();
    const activityId = await anActivity();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/activities/${activityId}/comments`,
      headers: { authorization: strangerAuth },
      payload: { text: 'oi' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('ACTIVITY_NOT_FOUND');
  });
});
