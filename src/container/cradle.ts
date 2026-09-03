import type { AppConfig } from '../config';
import type { Db, MongoClient } from '../db';
import type { HealthRepository } from '../repositories/health';
import type { GetHealth } from '../services/health';

/**
 * Everything resolvable from the Awilix container.
 * Registered via `registerInfrastructure` / `registerRepositories` / `registerServices`.
 */
export interface AppCradle {
  config: AppConfig;
  mongoClient: MongoClient;
  db: Db;
  healthRepository: HealthRepository;
  getHealthService: GetHealth;
}
