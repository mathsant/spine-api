import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import { getFeedSchema } from '../../schemas/feed';
import type { GetFeed } from '../../services/feed';

export async function getFeedController(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const { cursor, limit } = getFeedSchema.parse(request.query);
  const getFeed = request.diScope.resolve<GetFeed>('getFeedService');

  const page = await getFeed({ userId: currentUser.id, cursor: cursor ?? null, limit });

  await reply.status(200).send(page);
}
