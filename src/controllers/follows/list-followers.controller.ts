import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { listConnectionsSchema } from '../../schemas/follows';
import type { ListFollowers } from '../../services/follows';

export async function listFollowersController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { cursor, limit } = listConnectionsSchema.parse(request.query);
  const listFollowers = request.diScope.resolve<ListFollowers>('listFollowersService');

  const page = await listFollowers({ userId: currentUser.id, cursor: cursor ?? null, limit });

  await reply.status(200).send(page);
}
