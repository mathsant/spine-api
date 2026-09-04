import type { MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../../src/app';
import type { AppConfig } from '../../../src/config';
import { type MongoMemory, startMongoMemory } from '../../helpers/mongo-memory';

describe('application shutdown (integration)', () => {
  let mongo: MongoMemory;

  beforeAll(async () => {
    mongo = await startMongoMemory();
  });

  afterAll(async () => {
    await mongo.stop();
  });

  it('closes the MongoClient when the app closes (Awilix disposer)', async () => {
    const config: AppConfig = {
      nodeEnv: 'test',
      port: 0,
      host: '127.0.0.1',
      mongoUri: mongo.uri,
      mongoDbName: 'shutdown_test',
      logLevel: 'silent',
      accessTokenSecret: 'test-access-token-secret-0123456789abcdef',
      authRateLimitMax: 10,
      authRateLimitWindowMs: 900_000,
    };

    const app = await buildApp(config);
    // Force the singleton client to be created and connected.
    await app.inject({ method: 'GET', url: '/health' });

    const client = app.diContainer.resolve<MongoClient>('mongoClient');
    const closeSpy = vi.spyOn(client, 'close');

    await app.close();

    expect(closeSpy).toHaveBeenCalled();
    await expect(client.db('shutdown_test').command({ ping: 1 })).rejects.toBeDefined();
  });
});
