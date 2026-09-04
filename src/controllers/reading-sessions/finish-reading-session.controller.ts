import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { finishReadingSessionSchema } from '../../schemas/reading-sessions';
import type { FinishReadingSession } from '../../services/reading-sessions';

export async function finishReadingSessionController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { sessionId } = request.params as { sessionId: string };
  const { finishedAt } = finishReadingSessionSchema.parse(request.body ?? {});
  const finishReadingSession = request.diScope.resolve<FinishReadingSession>(
    'finishReadingSessionService',
  );

  const session = await finishReadingSession({
    userId: currentUser.id,
    sessionId,
    finishedAt: finishedAt ? new Date(finishedAt) : undefined,
  });

  await reply.status(200).send(session);
}
