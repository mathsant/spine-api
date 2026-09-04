import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { updateProgressSchema } from '../../schemas/reading-sessions';
import type { UpdateProgress } from '../../services/reading-sessions';

export async function updateProgressController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { sessionId } = request.params as { sessionId: string };
  const { currentPage } = updateProgressSchema.parse(request.body);
  const updateProgress = request.diScope.resolve<UpdateProgress>('updateProgressService');

  const session = await updateProgress({ userId: currentUser.id, sessionId, currentPage });

  await reply.status(200).send(session);
}
