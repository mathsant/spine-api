import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { searchUsersSchema } from '../../schemas/users';
import type { SearchUsers } from '../../services/users';

export async function searchUsersController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { q, page, limit } = searchUsersSchema.parse(request.query);
  const searchUsers = request.diScope.resolve<SearchUsers>('searchUsersService');

  const result = await searchUsers({ viewerId: currentUser.id, q, page, limit });

  await reply.status(200).send(result);
}
