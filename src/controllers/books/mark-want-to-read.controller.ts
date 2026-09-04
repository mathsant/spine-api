import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { MarkWantToRead } from '../../services/books';

export async function markWantToReadController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { olid } = request.params as { olid: string };
  const markWantToRead = request.diScope.resolve<MarkWantToRead>('markWantToReadService');

  await markWantToRead({ userId: currentUser.id, olid });

  await reply.status(204).send();
}
