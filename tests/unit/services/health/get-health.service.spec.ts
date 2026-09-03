import { describe, expect, it } from 'vitest';

import type { HealthRepository } from '../../../../src/repositories/health';
import { makeGetHealth } from '../../../../src/services/health';

const fakeRepository = (up: boolean): HealthRepository => ({
  ping: () => Promise.resolve(up),
});

describe('makeGetHealth', () => {
  it('returns ok/up when the repository ping succeeds', async () => {
    const getHealth = makeGetHealth({ healthRepository: fakeRepository(true) });

    const status = await getHealth();

    expect(status).toMatchObject({ status: 'ok', db: 'up' });
    expect(Number.isInteger(status.uptime)).toBe(true);
    expect(status.uptime).toBeGreaterThanOrEqual(0);
  });

  it('returns degraded/down when the repository ping fails', async () => {
    const getHealth = makeGetHealth({ healthRepository: fakeRepository(false) });

    const status = await getHealth();

    expect(status).toMatchObject({ status: 'degraded', db: 'down' });
  });
});
