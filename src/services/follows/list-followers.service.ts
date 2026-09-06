import type { FollowRequestRepository } from '../../repositories/follow-requests';
import type { FollowRepository } from '../../repositories/follows';
import type { UserRepository } from '../../repositories/users';
import { resolveRelationships } from './resolve-relationships';
import type { FollowCursorPageDTO } from './types';

export interface ListFollowersInput {
  userId: string;
  cursor: string | null;
  limit: number;
}

export type ListFollowers = (input: ListFollowersInput) => Promise<FollowCursorPageDTO>;

export interface ListFollowersDeps {
  followRepository: FollowRepository;
  followRequestRepository: FollowRequestRepository;
  userRepository: UserRepository;
}

/** Lists my own approved followers (RF-018). Visible only to the owner (RF-020). Each item
 * carries `followState`/`followsYou` relative to me (011 — D4), resolved in one batch. */
export const makeListFollowers =
  ({ followRepository, followRequestRepository, userRepository }: ListFollowersDeps): ListFollowers =>
  async ({ userId, cursor, limit }) => {
    const page = await followRepository.listByFollowee(userId, cursor, limit);
    const followerIds = page.items.map((record) => record.followerId);

    const [followers, relationships] = await Promise.all([
      Promise.all(followerIds.map((id) => userRepository.findById(id))),
      resolveRelationships(userId, followerIds, { followRepository, followRequestRepository }),
    ]);

    return {
      items: page.items.map((record, index) => {
        const follower = followers[index];
        const relationship = relationships.get(record.followerId) ?? {
          followState: 'none' as const,
          followsYou: false,
        };
        return {
          userId: record.followerId,
          handle: follower?.handle ?? '',
          displayName: follower?.displayName ?? '',
          createdAt: record.createdAt.toISOString(),
          followState: relationship.followState,
          followsYou: relationship.followsYou,
        };
      }),
      nextCursor: page.nextCursor,
    };
  };
