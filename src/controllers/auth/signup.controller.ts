import type { FastifyReply, FastifyRequest } from 'fastify';

import { signupSchema } from '../../schemas/auth';
import type { Signup } from '../../services/auth';

export async function signupController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const input = signupSchema.parse(request.body);
  const signup = request.diScope.resolve<Signup>('signupService');

  const user = await signup(input);

  await reply.status(201).send(user);
}
