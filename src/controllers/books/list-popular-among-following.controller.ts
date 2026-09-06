import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { ListPopularAmongFollowing } from '../../services/books';

export async function listPopularAmongFollowingController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const listPopularAmongFollowing = request.diScope.resolve<ListPopularAmongFollowing>(
    'listPopularAmongFollowingService',
  );

  const result = await listPopularAmongFollowing({ userId: currentUser.id });

  await reply.status(200).send(result);
}
