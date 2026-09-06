import type { FollowRequestRepository } from '../../repositories/follow-requests';
import type { FollowRepository } from '../../repositories/follows';
import type { UserRepository } from '../../repositories/users';
import { resolveRelationships } from '../follows';
import type { UserSearchPageDTO } from './types';

export interface SearchUsersInput {
  viewerId: string;
  q: string;
  page: number;
  limit: number;
}

export type SearchUsers = (input: SearchUsersInput) => Promise<UserSearchPageDTO>;

export interface SearchUsersDeps {
  userRepository: UserRepository;
  followRepository: FollowRepository;
  followRequestRepository: FollowRequestRepository;
}

/**
 * Searches users by displayName/handle (RF-004, P14 — minimal result surface). Each item
 * carries `followState`/`followsYou` relative to the viewer (011 — D4), resolved in one
 * batch for the whole page (no N+1).
 */
export const makeSearchUsers =
  ({ userRepository, followRepository, followRequestRepository }: SearchUsersDeps): SearchUsers =>
  async ({ viewerId, q, page, limit }) => {
    const result = await userRepository.search(q, page, limit);
    const relationships = await resolveRelationships(
      viewerId,
      result.items.map((item) => item.id),
      { followRepository, followRequestRepository },
    );

    return {
      items: result.items.map((item) => {
        const relationship = relationships.get(item.id) ?? {
          followState: 'none' as const,
          followsYou: false,
        };
        return {
          id: item.id,
          handle: item.handle,
          displayName: item.displayName,
          avatarUrl: null,
          followState: relationship.followState,
          followsYou: relationship.followsYou,
        };
      }),
      page: result.page,
      limit: result.limit,
      totalItems: result.totalItems,
    };
  };
