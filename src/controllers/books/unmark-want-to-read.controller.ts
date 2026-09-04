import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { UnmarkWantToRead } from '../../services/books';

export async function unmarkWantToReadController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { olid } = request.params as { olid: string };
  const unmarkWantToRead = request.diScope.resolve<UnmarkWantToRead>('unmarkWantToReadService');

  await unmarkWantToRead({ userId: currentUser.id, olid });

  await reply.status(204).send();
}
