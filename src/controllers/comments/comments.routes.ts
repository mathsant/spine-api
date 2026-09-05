import type { FastifyPluginCallback } from 'fastify';

import { createCommentController } from './create-comment.controller';
import { deleteCommentController } from './delete-comment.controller';
import { listCommentsController } from './list-comments.controller';

/**
 * Routes of the `comments` domain. Registered under `{ prefix: '/v1' }`. An `:activityId` that
 * does not exist or is not visible to the caller is reported as 404 `ACTIVITY_NOT_FOUND` either
 * way (P6); a `:commentId` that is not the caller's own is reported as 404 `COMMENT_NOT_FOUND`.
 */
export const commentsRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.post(
    '/activities/:activityId/comments',
    { preHandler: app.authenticate },
    createCommentController,
  );
  app.get(
    '/activities/:activityId/comments',
    { preHandler: app.authenticate },
    listCommentsController,
  );
  app.delete('/comments/:commentId', { preHandler: app.authenticate }, deleteCommentController);

  done();
};
