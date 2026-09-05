import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { DeleteReaction } from '../../services/reactions';

export async function deleteReactionController(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { activityId } = request.params as { activityId: string };
  const deleteReaction = request.diScope.resolve<DeleteReaction>('deleteReactionService');

  await deleteReaction({ userId: currentUser.id, activityId });

  await reply.status(204).send();
}
