import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { listWantToReadSchema } from '../../schemas/books';
import type { ListWantToRead } from '../../services/books';

export async function listWantToReadController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { cursor, limit } = listWantToReadSchema.parse(request.query);
  const listWantToRead = request.diScope.resolve<ListWantToRead>('listWantToReadService');

  const page = await listWantToRead({ userId: currentUser.id, cursor: cursor ?? null, limit });

  await reply.status(200).send(page);
}
