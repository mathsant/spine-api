import type { FastifyPluginCallback } from 'fastify';

import { createReactionController } from './create-reaction.controller';
import { deleteReactionController } from './delete-reaction.controller';

/**
 * Routes of the `reactions` domain. Registered under `{ prefix: '/v1' }`. An `:activityId` that
 * does not exist or is not visible to the caller (not the owner, not an approved follower) is
 * reported as 404 `ACTIVITY_NOT_FOUND` either way (P6).
 */
export const reactionsRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.post(
    '/activities/:activityId/reactions',
    { preHandler: app.authenticate },
    createReactionController,
  );
  app.delete(
    '/activities/:activityId/reactions',
    { preHandler: app.authenticate },
    deleteReactionController,
  );

  done();
};
