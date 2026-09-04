import { Writable } from 'node:stream';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../../src/app';
import { ensureAuthIndexes } from '../../helpers/auth-indexes';
import { testConfig } from '../../helpers/config';
import { type MongoMemory, startMongoMemory } from '../../helpers/mongo-memory';

/** Collects everything written to it as a single string. */
function collectingStream(): { stream: Writable; text: () => string } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer | string, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  return { stream, text: () => chunks.join('') };
}

describe('auth logging (integration)', () => {
  let mongo: MongoMemory;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    await ensureAuthIndexes(mongo.client.db('auth_logging_test'));
  });

  afterAll(async () => {
    await mongo.stop();
  });

  it('never writes a token, password or hash to the logs across the whole flow', async () => {
    const log = collectingStream();
    const app = await buildApp(
      testConfig({
        mongoUri: mongo.uri,
        mongoDbName: 'auth_logging_test',
        logLevel: 'trace',
        authRateLimitMax: 100,
      }),
      { loggerStream: log.stream },
    );

    const password = 'super secret passphrase 123';
    const newPassword = 'an even better passphrase 456';

    try {
      await app.inject({
        method: 'POST',
        url: '/v1/auth/signup',
        payload: { email: 'alice@example.com', password, handle: 'alice', displayName: 'Alice' },
      });

      const login = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: 'alice@example.com', password },
      });
      const { accessToken, refreshToken } = login.json();

      const refreshed = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken },
      });
      const rotatedRefresh = refreshed.json().refreshToken as string;

      await app.inject({
        method: 'POST',
        url: '/v1/auth/change-password',
        headers: { authorization: `Bearer ${accessToken as string}` },
        payload: { currentPassword: password, newPassword, refreshToken: rotatedRefresh },
      });

      await app.inject({
        method: 'POST',
        url: '/v1/auth/logout',
        payload: { refreshToken: rotatedRefresh },
      });

      const logs = log.text();
      expect(logs.length).toBeGreaterThan(0);
      for (const secret of [password, newPassword, accessToken, refreshToken, rotatedRefresh]) {
        expect(logs).not.toContain(secret as string);
      }
      expect(logs).not.toContain('passwordHash');
      expect(logs).not.toMatch(/scrypt\$/);
    } finally {
      await app.close();
    }
  });
});
