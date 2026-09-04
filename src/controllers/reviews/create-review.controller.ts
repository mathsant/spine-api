import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { createReviewSchema } from '../../schemas/reviews';
import type { CreateReview } from '../../services/reviews';

export async function createReviewController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { sessionId } = request.params as { sessionId: string };
  const input = createReviewSchema.parse(request.body);
  const createReview = request.diScope.resolve<CreateReview>('createReviewService');

  const review = await createReview({
    userId: currentUser.id,
    sessionId,
    rating: input.rating,
    text: input.text,
    containsSpoiler: input.containsSpoiler,
  });

  await reply.status(201).send(review);
}
