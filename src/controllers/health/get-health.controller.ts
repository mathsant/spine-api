import type { FastifyReply, FastifyRequest } from 'fastify';

import type { GetHealth } from '../../services/health';

export async function getHealthController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const getHealthService = request.diScope.resolve<GetHealth>('getHealthService');
  const status = await getHealthService();

  await reply.status(status.status === 'ok' ? 200 : 503).send(status);
}
