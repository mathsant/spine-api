import type { FastifyPluginCallback } from 'fastify';

import { deleteReadingSessionController } from './delete-reading-session.controller';
import { editReadingSessionController } from './edit-reading-session.controller';
import { finishReadingSessionController } from './finish-reading-session.controller';
import { listReadingSessionsController } from './list-reading-sessions.controller';
import { updateProgressController } from './update-progress.controller';

/**
 * Routes of the `reading-sessions` domain. Registered under `{ prefix: '/v1' }`.
 * Every route requires a valid access token (RF-020); a session that exists but
 * belongs to someone else is reported the same as a nonexistent one (D9).
 */
export const readingSessionsRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.post(
    '/reading-sessions/:sessionId/progress',
    { preHandler: app.authenticate },
    updateProgressController,
  );
  app.post(
    '/reading-sessions/:sessionId/finish',
    { preHandler: app.authenticate },
    finishReadingSessionController,
  );
  app.patch(
    '/reading-sessions/:sessionId',
    { preHandler: app.authenticate },
    editReadingSessionController,
  );
  app.delete(
    '/reading-sessions/:sessionId',
    { preHandler: app.authenticate },
    deleteReadingSessionController,
  );
  app.get('/me/reading-sessions', { preHandler: app.authenticate }, listReadingSessionsController);

  done();
};
