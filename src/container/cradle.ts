import type { AppConfig } from '../config';
import type { Db, MongoClient } from '../db';

/**
 * Everything resolvable from the Awilix container. Extended as layers are added.
 * Registered via `registerInfrastructure` / `registerRepositories` / `registerServices`.
 *
 * Used as the explicit generic for `AwilixContainer<AppCradle>` and when reading
 * `request.diScope.cradle` in controllers.
 */
export interface AppCradle {
  config: AppConfig;
  mongoClient: MongoClient;
  db: Db;
}
