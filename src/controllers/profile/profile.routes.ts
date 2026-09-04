import type { FastifyPluginCallback } from 'fastify';

import { editProfileController } from './edit-profile.controller';

/** Routes of the `profile` domain. Registered under `{ prefix: '/v1' }`. */
export const profileRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.patch('/me', { preHandler: app.authenticate }, editProfileController);

  done();
};
