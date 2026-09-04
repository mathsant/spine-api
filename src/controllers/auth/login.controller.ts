import type { FastifyReply, FastifyRequest } from 'fastify';

import { loginSchema } from '../../schemas/auth';
import type { Login } from '../../services/auth';

export async function loginController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const input = loginSchema.parse(request.body);
  const login = request.diScope.resolve<Login>('loginService');

  const pair = await login(input);

  await reply.status(200).send(pair);
}
