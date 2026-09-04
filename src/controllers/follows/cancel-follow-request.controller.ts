import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { CancelFollowRequest } from '../../services/follows';

export async function cancelFollowRequestController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { userId } = request.params as { userId: string };
  const cancelFollowRequest = request.diScope.resolve<CancelFollowRequest>('cancelFollowRequestService');

  await cancelFollowRequest({ requesterId: currentUser.id, targetId: userId });

  await reply.status(204).send();
}
