import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { listFollowRequestsSchema } from '../../schemas/follows';
import type { ListFollowRequests } from '../../services/follows';

export async function listFollowRequestsController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const input = listFollowRequestsSchema.parse(request.query);
  const listFollowRequests = request.diScope.resolve<ListFollowRequests>('listFollowRequestsService');

  const page = await listFollowRequests({
    userId: currentUser.id,
    direction: input.direction,
    cursor: input.cursor ?? null,
    limit: input.limit,
  });

  await reply.status(200).send(page);
}
