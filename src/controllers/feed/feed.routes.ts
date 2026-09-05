import type { FastifyPluginCallback } from 'fastify';

import { getFeedController } from './get-feed.controller';

/** Routes of the `feed` domain. Registered under `{ prefix: '/v1' }`. Requires a valid access token. */
export const feedRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/feed', { preHandler: app.authenticate }, getFeedController);

  done();
};
