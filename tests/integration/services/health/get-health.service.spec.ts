import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MongoHealthRepository } from '../../../../src/repositories/health/mongo-health.repository';
import { makeGetHealth } from '../../../../src/services/health';
import {
  createUnreachableClient,
  type MongoMemory,
  startMongoMemory,
} from '../../../helpers/mongo-memory';

describe('getHealth service (integration)', () => {
  let mongo: MongoMemory;

  beforeAll(async () => {
    mongo = await startMongoMemory();
  });

  afterAll(async () => {
    await mongo.stop();
  });

  it('reports ok/up when MongoDB answers the ping', async () => {
    const repository = new MongoHealthRepository(mongo.client.db('health_test'));
    const getHealth = makeGetHealth({ healthRepository: repository });

    const status = await getHealth();

    expect(status.status).toBe('ok');
    expect(status.db).toBe('up');
    expect(Number.isInteger(status.uptime)).toBe(true);
    expect(status.uptime).toBeGreaterThanOrEqual(0);
  });

  it('reports degraded/down when MongoDB is unreachable, without throwing', async () => {
    const downClient = createUnreachableClient();
    const repository = new MongoHealthRepository(downClient.db('health_test'));
    const getHealth = makeGetHealth({ healthRepository: repository });

    const status = await getHealth();

    expect(status.status).toBe('degraded');
    expect(status.db).toBe('down');

    await downClient.close();
  });
});
