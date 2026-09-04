// @ts-check
'use strict';

// Load .env if present so `npm run migrate:*` works without exported vars.
try {
  require('node:process').loadEnvFile('.env');
} catch {
  // no .env file — rely on the ambient environment
}

const { MONGO_URI, MONGO_DB_NAME } = process.env;

if (!MONGO_URI || !MONGO_DB_NAME) {
  throw new Error('migrate-mongo: MONGO_URI and MONGO_DB_NAME must be set (see .env.example).');
}

/** @type {import('migrate-mongo').config.Config} */
const config = {
  mongodb: {
    url: MONGO_URI,
    databaseName: MONGO_DB_NAME,
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',
  lockCollectionName: 'changelog_lock',
  // migrate-mongo's lock collection needs an explicit positive TTL (seconds) to build
  // its expiry index; single-instance MVP (no concurrent migration runners), so this
  // just bounds how long a crashed run would hold the lock.
  lockTtl: 600,
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'commonjs',
};

module.exports = config;
