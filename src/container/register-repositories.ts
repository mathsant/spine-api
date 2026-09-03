import { asFunction, type AwilixContainer } from 'awilix';

import { MongoHealthRepository } from '../repositories/health';
import type { AppCradle } from './cradle';

export function registerRepositories(container: AwilixContainer<AppCradle>): void {
  container.register({
    healthRepository: asFunction(
      (cradle: AppCradle) => new MongoHealthRepository(cradle.db),
    ).singleton(),
  });
}
