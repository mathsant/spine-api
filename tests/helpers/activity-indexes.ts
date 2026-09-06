import type { Db } from 'mongodb';

/**
 * Applies the indexes the `activities` migration creates, on a given `Db`. The
 * `migrate-mongo` migrations do not run under `mongodb-memory-server`, so integration
 * tests that assert index usage (feature 011, RNF-001) call this in `beforeAll`. Keep it
 * in sync with `migrations/20260904233000-create-activities-collection.js`.
 */
export async function ensureActivityIndexes(db: Db): Promise<void> {
  await db
    .collection('activities')
    .createIndex({ actorId: 1, createdAt: -1, _id: -1 }, { name: 'activities_actorId_createdAt' });
  await db
    .collection('activities')
    .createIndex({ readingSessionId: 1 }, { name: 'activities_readingSessionId' });
}
