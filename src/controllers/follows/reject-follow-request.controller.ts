import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { RejectFollowRequest } from '../../services/follows';

export async function rejectFollowRequestController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { userId } = request.params as { userId: string };
  const rejectFollowRequest = request.diScope.resolve<RejectFollowRequest>('rejectFollowRequestService');

  await rejectFollowRequest({ targetId: currentUser.id, requesterId: userId });

  await reply.status(204).send();
}
