import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { StartReading } from '../../services/reading-sessions';

export async function startReadingController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { olid } = request.params as { olid: string };
  const startReading = request.diScope.resolve<StartReading>('startReadingService');

  const { session, created } = await startReading({ userId: currentUser.id, olid });

  await reply.status(created ? 201 : 200).send(session);
}
