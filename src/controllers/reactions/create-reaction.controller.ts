import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { CreateReaction } from '../../services/reactions';

export async function createReactionController(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { activityId } = request.params as { activityId: string };
  const createReaction = request.diScope.resolve<CreateReaction>('createReactionService');

  await createReaction({ userId: currentUser.id, activityId });

  await reply.status(204).send();
}
