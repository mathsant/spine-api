import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { DeleteReadingSession } from '../../services/reading-sessions';

export async function deleteReadingSessionController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { sessionId } = request.params as { sessionId: string };
  const deleteReadingSession = request.diScope.resolve<DeleteReadingSession>(
    'deleteReadingSessionService',
  );

  await deleteReadingSession({ userId: currentUser.id, sessionId });

  await reply.status(204).send();
}
