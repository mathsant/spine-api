import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { ApproveFollowRequest } from '../../services/follows';

export async function approveFollowRequestController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { userId } = request.params as { userId: string };
  const approveFollowRequest = request.diScope.resolve<ApproveFollowRequest>('approveFollowRequestService');

  await approveFollowRequest({ targetId: currentUser.id, requesterId: userId });

  await reply.status(204).send();
}
