import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { markFinishedSchema } from '../../schemas/books';
import type { MarkFinished } from '../../services/reading-sessions';

export async function markFinishedController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { olid } = request.params as { olid: string };
  const input = markFinishedSchema.parse(request.body);
  const markFinished = request.diScope.resolve<MarkFinished>('markFinishedService');

  const session = await markFinished({
    userId: currentUser.id,
    olid,
    startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
    finishedAt: new Date(input.finishedAt),
  });

  await reply.status(201).send(session);
}
