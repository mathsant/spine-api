import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthenticatedError } from '../../errors';
import type { GetFollowSuggestions } from '../../services/users';

export async function getFollowSuggestionsController(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const currentUser = request.currentUser;
  if (!currentUser) {
    throw new UnauthenticatedError();
  }

  const getFollowSuggestions =
    request.diScope.resolve<GetFollowSuggestions>('getFollowSuggestionsService');

  const suggestions = await getFollowSuggestions({ viewerId: currentUser.id });

  await reply.status(200).send(suggestions);
}
