import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { RemoveFollower } from '../../services/follows';

export async function removeFollowerController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { userId } = request.params as { userId: string };
  const removeFollower = request.diScope.resolve<RemoveFollower>('removeFollowerService');

  await removeFollower({ followeeId: currentUser.id, followerId: userId });

  await reply.status(204).send();
}
