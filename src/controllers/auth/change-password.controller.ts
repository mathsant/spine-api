import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { changePasswordSchema } from '../../schemas/auth';
import type { ChangePassword } from '../../services/auth';

export async function changePasswordController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const input = changePasswordSchema.parse(request.body);
  const changePassword = request.diScope.resolve<ChangePassword>('changePasswordService');

  await changePassword({ userId: currentUser.id, ...input });

  await reply.status(204).send();
}
