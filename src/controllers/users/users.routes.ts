import type { FastifyPluginCallback } from 'fastify';

import { searchUsersController } from './search-users.controller';

/** Routes of the `users` domain. Registered under `{ prefix: '/v1' }`. */
export const usersRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/users/search', { preHandler: app.authenticate }, searchUsersController);

  done();
};
