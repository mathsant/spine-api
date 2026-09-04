import type { Db } from 'mongodb';

/**
 * Applies the same indexes the auth migrations create, on a given `Db`.
 * The `migrate-mongo` migrations do not run under `mongodb-memory-server`, so
 * integration tests that rely on unique-index behaviour (the `code 11000`
 * translation) call this in `beforeAll`. Keep it in sync with `migrations/`.
 */
export async function ensureAuthIndexes(db: Db): Promise<void> {
  await db
    .collection('users')
    .createIndex({ email: 1 }, { unique: true, name: 'users_email_unique' });
  await db
    .collection('users')
    .createIndex({ handle: 1 }, { unique: true, name: 'users_handle_unique' });
  await db
    .collection('users')
    .createIndex(
      { displayName: 'text', handle: 'text' },
      { name: 'users_displayName_handle_text' },
    );
  await db.collection('auth_sessions').createIndex({ userId: 1 }, { name: 'auth_sessions_userId' });
  await db
    .collection('refresh_tokens')
    .createIndex({ tokenHash: 1 }, { unique: true, name: 'refresh_tokens_tokenHash_unique' });
  await db
    .collection('refresh_tokens')
    .createIndex({ sessionId: 1 }, { name: 'refresh_tokens_sessionId' });
}
