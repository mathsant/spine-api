import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { GetUnreadNotificationCount } from '../../services/notifications';

export async function getUnreadNotificationCountController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const getUnreadNotificationCount = request.diScope.resolve<GetUnreadNotificationCount>(
    'getUnreadNotificationCountService',
  );

  const count = await getUnreadNotificationCount(currentUser.id);

  await reply.status(200).send({ count });
}
