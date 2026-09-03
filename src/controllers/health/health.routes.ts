import type { FastifyPluginCallback } from 'fastify';

import { getHealthController } from './get-health.controller';

/** Fastify plugin owning the `health` domain routes. */
export const healthRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/health', getHealthController);
  done();
};
