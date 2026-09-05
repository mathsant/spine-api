import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { MarkAllNotificationsRead } from '../../services/notifications';

export async function markAllNotificationsReadController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const markAllNotificationsRead = request.diScope.resolve<MarkAllNotificationsRead>(
    'markAllNotificationsReadService',
  );

  await markAllNotificationsRead(currentUser.id);

  await reply.status(204).send();
}
