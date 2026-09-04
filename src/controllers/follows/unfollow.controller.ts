import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { Unfollow } from '../../services/follows';

export async function unfollowController(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { userId } = request.params as { userId: string };
  const unfollow = request.diScope.resolve<Unfollow>('unfollowService');

  await unfollow({ followerId: currentUser.id, followeeId: userId });

  await reply.status(204).send();
}
