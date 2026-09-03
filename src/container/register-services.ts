import { asFunction, type AwilixContainer } from 'awilix';

import { makeGetHealth } from '../services/health';
import type { AppCradle } from './cradle';

export function registerServices(container: AwilixContainer<AppCradle>): void {
  container.register({
    getHealthService: asFunction((cradle: AppCradle) =>
      makeGetHealth({ healthRepository: cradle.healthRepository }),
    ).singleton(),
  });
}
