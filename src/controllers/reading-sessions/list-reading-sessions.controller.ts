import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { listReadingSessionsSchema } from '../../schemas/reading-sessions';
import type { ListReadingSessions } from '../../services/reading-sessions';

export async function listReadingSessionsController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { bookId, cursor, limit } = listReadingSessionsSchema.parse(request.query);
  const listReadingSessions = request.diScope.resolve<ListReadingSessions>(
    'listReadingSessionsService',
  );

  const page = await listReadingSessions({
    userId: currentUser.id,
    bookId,
    cursor: cursor ?? null,
    limit,
  });

  await reply.status(200).send(page);
}
