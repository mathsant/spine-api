import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { SendFollowRequest } from '../../services/follows';

export async function sendFollowRequestController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { userId } = request.params as { userId: string };
  const sendFollowRequest = request.diScope.resolve<SendFollowRequest>('sendFollowRequestService');

  const { request: followRequest, created } = await sendFollowRequest({
    requesterId: currentUser.id,
    targetId: userId,
  });

  await reply.status(created ? 201 : 200).send(followRequest);
}
