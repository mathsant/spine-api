import { asFunction, type AwilixContainer } from 'awilix';

import { MongoAuthSessionRepository } from '../repositories/auth-sessions';
import { MongoHealthRepository } from '../repositories/health';
import { MongoUserRepository } from '../repositories/users';
import type { AppCradle } from './cradle';

export function registerRepositories(container: AwilixContainer<AppCradle>): void {
  container.register({
    healthRepository: asFunction(
      (cradle: AppCradle) => new MongoHealthRepository(cradle.db),
    ).singleton(),
    userRepository: asFunction(
      (cradle: AppCradle) => new MongoUserRepository(cradle.db),
    ).singleton(),
    authSessionRepository: asFunction(
      (cradle: AppCradle) => new MongoAuthSessionRepository(cradle.db),
    ).singleton(),
  });
}
