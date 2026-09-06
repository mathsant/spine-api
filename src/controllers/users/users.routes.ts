import type { FastifyPluginCallback } from 'fastify';

import { getUserProfileController } from './get-user-profile.controller';
import { listUserActivityController } from './list-user-activity.controller';
import { searchUsersController } from './search-users.controller';

/** Routes of the `users` domain. Registered under `{ prefix: '/v1' }`. */
export const usersRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/users/search', { preHandler: app.authenticate }, searchUsersController);
  app.get('/users/:userId', { preHandler: app.authenticate }, getUserProfileController);
  app.get('/users/:userId/activity', { preHandler: app.authenticate }, listUserActivityController);

  done();
};
