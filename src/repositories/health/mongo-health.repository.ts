import type { Db } from 'mongodb';

import type { HealthRepository } from './health.repository';

const PING_TIMEOUT_MS = 1000;

export class MongoHealthRepository implements HealthRepository {
  constructor(private readonly db: Db) {}

  async ping(): Promise<boolean> {
    try {
      await this.db.command({ ping: 1 }, { signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
      return true;
    } catch {
      return false;
    }
  }
}
