import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { DeleteReview } from '../../services/reviews';

export async function deleteReviewController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { reviewId } = request.params as { reviewId: string };
  const deleteReview = request.diScope.resolve<DeleteReview>('deleteReviewService');

  await deleteReview({ userId: currentUser.id, reviewId });

  await reply.status(204).send();
}
