import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { MarkNotificationRead } from '../../services/notifications';

export async function markNotificationReadController(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { notificationId } = request.params as { notificationId: string };
  const markNotificationRead = request.diScope.resolve<MarkNotificationRead>('markNotificationReadService');

  await markNotificationRead({ userId: currentUser.id, notificationId });

  await reply.status(204).send();
}
