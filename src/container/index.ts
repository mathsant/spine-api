import type { FastifyInstance } from 'fastify';
import type { AwilixContainer } from 'awilix';

import type { AppConfig } from '../config';
import type { AppCradle } from './cradle';
import { registerInfrastructure } from './register-infrastructure';
import { registerRepositories } from './register-repositories';
import { registerServices } from './register-services';

/** Wires every layer into the Fastify Awilix container. */
export function registerContainer(app: FastifyInstance, config: AppConfig): void {
  const container = app.diContainer as AwilixContainer<AppCradle>;
  registerInfrastructure(container, config);
  registerRepositories(container);
  registerServices(container);
}

export type { AppCradle } from './cradle';
