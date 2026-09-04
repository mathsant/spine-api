import { asFunction, asValue, type AwilixContainer } from 'awilix';

import type { AppConfig } from '../config';
import { createMongoClient } from '../db';
import { HttpOpenLibraryClient } from '../integrations/open-library';
import type { AppCradle } from './cradle';

/**
 * Registers config and the MongoDB connection.
 * `mongoClient` is a singleton with a disposer so `container.dispose()` (fired by
 * `app.close()`) closes the connection.
 */
export function registerInfrastructure(
  container: AwilixContainer<AppCradle>,
  config: AppConfig,
): void {
  container.register({
    config: asValue(config),
    clock: asValue({ now: () => new Date() }),
    mongoClient: asFunction((cradle: AppCradle) => createMongoClient(cradle.config))
      .singleton()
      .disposer((client) => client.close()),
    db: asFunction((cradle: AppCradle) =>
      cradle.mongoClient.db(cradle.config.mongoDbName),
    ).singleton(),
    openLibraryClient: asFunction(
      (cradle: AppCradle) =>
        new HttpOpenLibraryClient({
          baseUrl: cradle.config.openLibraryBaseUrl,
          timeoutMs: cradle.config.openLibraryTimeoutMs,
        }),
    ).singleton(),
  });
}
