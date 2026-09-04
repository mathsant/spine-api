import type { FastifyReply, FastifyRequest } from 'fastify';

import { searchUsersSchema } from '../../schemas/users';
import type { SearchUsers } from '../../services/users';

export async function searchUsersController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const input = searchUsersSchema.parse(request.query);
  const searchUsers = request.diScope.resolve<SearchUsers>('searchUsersService');

  const page = await searchUsers(input);

  await reply.status(200).send(page);
}
