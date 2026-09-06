import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { GetMyStats } from '../../services/profile';

export async function getMyStatsController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const getMyStats = request.diScope.resolve<GetMyStats>('getMyStatsService');

  const stats = await getMyStats({ userId: currentUser.id });

  await reply.status(200).send(stats);
}
