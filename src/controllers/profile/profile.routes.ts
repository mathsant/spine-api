import type { FastifyPluginCallback } from 'fastify';

import { editProfileController } from './edit-profile.controller';
import { getMyStatsController } from './get-my-stats.controller';

/** Routes of the `profile` domain. Registered under `{ prefix: '/v1' }`. */
export const profileRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.patch('/me', { preHandler: app.authenticate }, editProfileController);
  app.get('/me/stats', { preHandler: app.authenticate }, getMyStatsController);

  done();
};
