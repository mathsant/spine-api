/**
 * Seeds a single, fixed user for the front-end's live e2e / quickstart run so the
 * suite can exercise `POST /v1/auth/login` without spending the per-IP `signup`
 * rate-limit budget (10 req / 15 min).
 *
 * Idempotent: upserts on the normalised email and always rewrites the password
 * hash, so re-running it guarantees the credentials below keep working.
 *
 * Usage: `pnpm seed:e2e-user`  (refuses to run when NODE_ENV=production).
 */
import { hashPassword, normalizeEmail, normalizeHandle } from '../src/auth';
import { loadConfig } from '../src/config';
import { createMongoClient } from '../src/db';

const E2E_USER = {
  email: 'e2e-quickstart@spine.test',
  password: 'E2eQuickstart!2026',
  handle: 'e2equickstart',
  displayName: 'E2E Quickstart',
};

async function main(): Promise<void> {
  try {
    process.loadEnvFile('.env');
  } catch {
    // no .env file — rely on the ambient environment
  }

  const config = loadConfig(process.env);
  if (config.nodeEnv === 'production') {
    console.error('Refusing to seed the e2e user with NODE_ENV=production.');
    process.exit(1);
  }

  const client = createMongoClient(config);
  await client.connect();

  try {
    const email = normalizeEmail(E2E_USER.email);
    const handle = normalizeHandle(E2E_USER.handle);
    const passwordHash = await hashPassword(E2E_USER.password);
    const now = new Date();

    const result = await client
      .db(config.mongoDbName)
      .collection('users')
      .updateOne(
        { email },
        {
          $set: { passwordHash, handle, displayName: E2E_USER.displayName, updatedAt: now },
          $setOnInsert: { email, bio: null, createdAt: now },
        },
        { upsert: true },
      );

    const action = result.upsertedCount > 0 ? 'created' : 'updated';
    console.log(`e2e user ${action} in "${config.mongoDbName}".users`);
    console.log(`  email:    ${E2E_USER.email}`);
    console.log(`  password: ${E2E_USER.password}`);
    console.log(`  handle:   @${handle}`);
  } finally {
    await client.close();
  }
}

void main();
