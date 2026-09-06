import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { listBookReviewsSchema } from '../../schemas/books';
import type { ListBookReviews } from '../../services/books';

export async function listBookReviewsController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { olid } = request.params as { olid: string };
  const { cursor, limit } = listBookReviewsSchema.parse(request.query);
  const listBookReviews = request.diScope.resolve<ListBookReviews>('listBookReviewsService');

  const page = await listBookReviews({
    userId: currentUser.id,
    olid,
    cursor: cursor ?? null,
    limit,
  });

  await reply.status(200).send(page);
}
