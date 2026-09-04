import type { FastifyReply, FastifyRequest } from 'fastify';

import { refreshSchema } from '../../schemas/auth';
import type { Refresh } from '../../services/auth';

export async function refreshController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const input = refreshSchema.parse(request.body);
  const refresh = request.diScope.resolve<Refresh>('refreshService');

  const pair = await refresh(input);

  await reply.status(200).send(pair);
}
