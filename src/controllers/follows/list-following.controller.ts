import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { listConnectionsSchema } from '../../schemas/follows';
import type { ListFollowing } from '../../services/follows';

export async function listFollowingController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { cursor, limit } = listConnectionsSchema.parse(request.query);
  const listFollowing = request.diScope.resolve<ListFollowing>('listFollowingService');

  const page = await listFollowing({ userId: currentUser.id, cursor: cursor ?? null, limit });

  await reply.status(200).send(page);
}
