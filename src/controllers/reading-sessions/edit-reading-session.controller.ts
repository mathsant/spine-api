import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { editReadingSessionSchema } from '../../schemas/reading-sessions';
import type { EditReadingSession } from '../../services/reading-sessions';

export async function editReadingSessionController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { sessionId } = request.params as { sessionId: string };
  const input = editReadingSessionSchema.parse(request.body);
  const editReadingSession = request.diScope.resolve<EditReadingSession>('editReadingSessionService');

  const session = await editReadingSession({
    userId: currentUser.id,
    sessionId,
    patch: {
      startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
      finishedAt: input.finishedAt ? new Date(input.finishedAt) : undefined,
      currentPage: input.currentPage,
    },
  });

  await reply.status(200).send(session);
}
