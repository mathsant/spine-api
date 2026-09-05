import type { FastifyPluginCallback } from 'fastify';

import { getUnreadNotificationCountController } from './get-unread-notification-count.controller';
import { listNotificationsController } from './list-notifications.controller';
import { markAllNotificationsReadController } from './mark-all-notifications-read.controller';
import { markNotificationReadController } from './mark-notification-read.controller';

/**
 * Routes of the `notifications` domain. Registered under `{ prefix: '/v1' }`. Listing/count
 * always operate on the caller (`/me/...`, same pattern as `follows`); the two actions operate on
 * a notification id whose ownership is checked in the service (same pattern as
 * `DELETE /comments/:commentId`, no `/me/` prefix — 008, D8 of research.md).
 */
export const notificationsRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/me/notifications', { preHandler: app.authenticate }, listNotificationsController);
  app.get(
    '/me/notifications/unread-count',
    { preHandler: app.authenticate },
    getUnreadNotificationCountController,
  );
  app.post(
    '/notifications/:notificationId/read',
    { preHandler: app.authenticate },
    markNotificationReadController,
  );
  app.post('/notifications/read-all', { preHandler: app.authenticate }, markAllNotificationsReadController);

  done();
};
