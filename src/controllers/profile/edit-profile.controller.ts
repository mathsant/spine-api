import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { editProfileSchema } from '../../schemas/profile';
import type { EditProfile } from '../../services/profile';

export async function editProfileController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const input = editProfileSchema.parse(request.body);
  const editProfile = request.diScope.resolve<EditProfile>('editProfileService');

  const profile = await editProfile({ userId: currentUser.id, ...input });

  await reply.status(200).send(profile);
}
