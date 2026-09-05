import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { listCommentsSchema } from '../../schemas/comments';
import type { ListComments } from '../../services/comments';

export async function listCommentsController(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { activityId } = request.params as { activityId: string };
  const input = listCommentsSchema.parse(request.query);
  const listComments = request.diScope.resolve<ListComments>('listCommentsService');

  const page = await listComments({
    userId: currentUser.id,
    activityId,
    cursor: input.cursor ?? null,
    limit: input.limit,
  });

  await reply.status(200).send(page);
}
