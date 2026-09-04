import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { editReviewSchema } from '../../schemas/reviews';
import type { EditReview } from '../../services/reviews';

export async function editReviewController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { reviewId } = request.params as { reviewId: string };
  const patch = editReviewSchema.parse(request.body);
  const editReview = request.diScope.resolve<EditReview>('editReviewService');

  const review = await editReview({ userId: currentUser.id, reviewId, patch });

  await reply.status(200).send(review);
}
