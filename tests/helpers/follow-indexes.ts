import type { Db } from 'mongodb';

/**
 * Applies the same indexes the `follow_requests`/`follows` migrations create, on a given
 * `Db`. The `migrate-mongo` migrations do not run under `mongodb-memory-server`, so
 * integration tests that rely on unique-index behaviour (the `code 11000` translation on
 * `FollowRequest`/`Follow` creation) call this in `beforeAll`. Keep it in sync with
 * `migrations/`.
 */
export async function ensureFollowIndexes(db: Db): Promise<void> {
  await db
    .collection('follow_requests')
    .createIndex(
      { requesterId: 1, targetId: 1 },
      { unique: true, name: 'follow_requests_requesterId_targetId_unique' },
    );
  await db
    .collection('follow_requests')
    .createIndex({ targetId: 1, createdAt: -1 }, { name: 'follow_requests_targetId_createdAt' });
  await db
    .collection('follow_requests')
    .createIndex(
      { requesterId: 1, createdAt: -1 },
      { name: 'follow_requests_requesterId_createdAt' },
    );

  await db
    .collection('follows')
    .createIndex(
      { followerId: 1, followeeId: 1 },
      { unique: true, name: 'follows_followerId_followeeId_unique' },
    );
  await db
    .collection('follows')
    .createIndex({ followeeId: 1, createdAt: -1 }, { name: 'follows_followeeId_createdAt' });
  await db
    .collection('follows')
    .createIndex({ followerId: 1, createdAt: -1 }, { name: 'follows_followerId_createdAt' });
  await db
    .collection('follows')
    .createIndex({ followeeId: 1, followerId: 1 }, { name: 'follows_followeeId_followerId' });
}
