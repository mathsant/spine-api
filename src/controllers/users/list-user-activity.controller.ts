import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { listUserActivitySchema } from '../../schemas/users';
import type { ListUserActivity } from '../../services/users';

export async function listUserActivityController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { userId } = request.params as { userId: string };
  const { cursor, limit } = listUserActivitySchema.parse(request.query);
  const listUserActivity = request.diScope.resolve<ListUserActivity>('listUserActivityService');

  const page = await listUserActivity({
    viewerId: currentUser.id,
    userId,
    cursor: cursor ?? null,
    limit,
  });

  await reply.status(200).send(page);
}
