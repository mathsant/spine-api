import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { DeleteComment } from '../../services/comments';

export async function deleteCommentController(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { commentId } = request.params as { commentId: string };
  const deleteComment = request.diScope.resolve<DeleteComment>('deleteCommentService');

  await deleteComment({ userId: currentUser.id, commentId });

  await reply.status(204).send();
}
