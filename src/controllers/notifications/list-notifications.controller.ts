import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { listNotificationsSchema } from '../../schemas/notifications';
import type { ListNotifications } from '../../services/notifications';

export async function listNotificationsController(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const input = listNotificationsSchema.parse(request.query);
  const listNotifications = request.diScope.resolve<ListNotifications>('listNotificationsService');

  const page = await listNotifications({
    userId: currentUser.id,
    cursor: input.cursor ?? null,
    limit: input.limit,
  });

  await reply.status(200).send(page);
}
