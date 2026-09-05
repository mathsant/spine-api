import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { createCommentSchema } from '../../schemas/comments';
import type { CreateComment } from '../../services/comments';

export async function createCommentController(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { activityId } = request.params as { activityId: string };
  const input = createCommentSchema.parse(request.body);
  const createComment = request.diScope.resolve<CreateComment>('createCommentService');

  const comment = await createComment({
    userId: currentUser.id,
    activityId,
    text: input.text,
    parentCommentId: input.parentCommentId,
  });

  await reply.status(201).send(comment);
}
