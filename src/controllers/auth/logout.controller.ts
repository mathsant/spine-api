import type { FastifyReply, FastifyRequest } from 'fastify';

import { logoutSchema } from '../../schemas/auth';
import type { Logout } from '../../services/auth';

export async function logoutController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const input = logoutSchema.parse(request.body);
  const logout = request.diScope.resolve<Logout>('logoutService');

  await logout(input);

  await reply.status(204).send();
}
