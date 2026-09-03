import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../../src/app';
import type { AppConfig } from '../../../src/config';
import { type MongoMemory, startMongoMemory } from '../../helpers/mongo-memory';

const baseConfig = (overrides: Partial<AppConfig>): AppConfig => ({
  nodeEnv: 'test',
  port: 0,
  host: '127.0.0.1',
  mongoUri: 'mongodb://127.0.0.1:59999/?serverSelectionTimeoutMS=500',
  mongoDbName: 'health_test',
  logLevel: 'silent',
  ...overrides,
});

describe('GET /health (integration)', () => {
  let mongo: MongoMemory;

  beforeAll(async () => {
    mongo = await startMongoMemory();
  });

  afterAll(async () => {
    await mongo.stop();
  });

  it('returns 200 ok/up when MongoDB is reachable and echoes x-request-id', async () => {
    const app = await buildApp(baseConfig({ mongoUri: mongo.uri }));

    try {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { 'x-request-id': 'req-abc' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ status: 'ok', db: 'up' });
      expect(Number.isInteger((res.json() as { uptime: number }).uptime)).toBe(true);
      expect(res.headers['x-request-id']).toBe('req-abc');
    } finally {
      await app.close();
    }
  });

  it('returns 503 degraded/down when MongoDB is unreachable', async () => {
    const app = await buildApp(baseConfig({}));

    try {
      const res = await app.inject({ method: 'GET', url: '/health' });

      expect(res.statusCode).toBe(503);
      expect(res.json()).toMatchObject({ status: 'degraded', db: 'down' });
    } finally {
      await app.close();
    }
  });
});
