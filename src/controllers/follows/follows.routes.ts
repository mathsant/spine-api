import type { FastifyPluginCallback } from 'fastify';

import { approveFollowRequestController } from './approve-follow-request.controller';
import { cancelFollowRequestController } from './cancel-follow-request.controller';
import { listFollowersController } from './list-followers.controller';
import { listFollowingController } from './list-following.controller';
import { listFollowRequestsController } from './list-follow-requests.controller';
import { rejectFollowRequestController } from './reject-follow-request.controller';
import { removeFollowerController } from './remove-follower.controller';
import { sendFollowRequestController } from './send-follow-request.controller';
import { unfollowController } from './unfollow.controller';

/**
 * Routes of the `follows` domain. Registered under `{ prefix: '/v1' }`. None of the listing
 * routes accept a third-party `:userId` — they always operate on the caller (RF-020).
 */
export const followsRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.post(
    '/users/:userId/follow-request',
    { preHandler: app.authenticate },
    sendFollowRequestController,
  );
  app.delete(
    '/users/:userId/follow-request',
    { preHandler: app.authenticate },
    cancelFollowRequestController,
  );
  app.post(
    '/users/:userId/follow-request/approve',
    { preHandler: app.authenticate },
    approveFollowRequestController,
  );
  app.post(
    '/users/:userId/follow-request/reject',
    { preHandler: app.authenticate },
    rejectFollowRequestController,
  );
  app.delete('/users/:userId/follow', { preHandler: app.authenticate }, unfollowController);
  app.delete('/users/:userId/follower', { preHandler: app.authenticate }, removeFollowerController);
  app.get('/me/follow-requests', { preHandler: app.authenticate }, listFollowRequestsController);
  app.get('/me/followers', { preHandler: app.authenticate }, listFollowersController);
  app.get('/me/following', { preHandler: app.authenticate }, listFollowingController);

  done();
};
