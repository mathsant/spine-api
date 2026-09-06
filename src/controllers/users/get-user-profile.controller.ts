import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { GetUserProfile } from '../../services/users';

export async function getUserProfileController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { userId } = request.params as { userId: string };
  const getUserProfile = request.diScope.resolve<GetUserProfile>('getUserProfileService');

  const profile = await getUserProfile({ viewerId: currentUser.id, userId });

  await reply.status(200).send(profile);
}
