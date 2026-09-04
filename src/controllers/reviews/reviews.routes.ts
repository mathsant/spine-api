import type { FastifyPluginCallback } from 'fastify';

import { createReviewController } from './create-review.controller';
import { deleteReviewController } from './delete-review.controller';
import { editReviewController } from './edit-review.controller';

/**
 * Routes of the `reviews` domain. Registered under `{ prefix: '/v1' }`. A `:sessionId`/
 * `:reviewId` that exists but belongs to someone else is reported the same as a
 * nonexistent one (D7/D9).
 */
export const reviewsRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.post(
    '/reading-sessions/:sessionId/review',
    { preHandler: app.authenticate },
    createReviewController,
  );
  app.patch('/reviews/:reviewId', { preHandler: app.authenticate }, editReviewController);
  app.delete('/reviews/:reviewId', { preHandler: app.authenticate }, deleteReviewController);

  done();
};
