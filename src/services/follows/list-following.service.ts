import type { FollowRequestRepository } from '../../repositories/follow-requests';
import type { FollowRepository } from '../../repositories/follows';
import type { UserRepository } from '../../repositories/users';
import { resolveRelationships } from './resolve-relationships';
import type { FollowCursorPageDTO } from './types';

export interface ListFollowingInput {
  userId: string;
  cursor: string | null;
  limit: number;
}

export type ListFollowing = (input: ListFollowingInput) => Promise<FollowCursorPageDTO>;

export interface ListFollowingDeps {
  followRepository: FollowRepository;
  followRequestRepository: FollowRequestRepository;
  userRepository: UserRepository;
}

/** Lists who I own approved-follow (RF-019). Visible only to the owner (RF-020). Each item
 * carries `followState`/`followsYou` relative to me (011 — D4), resolved in one batch. */
export const makeListFollowing =
  ({ followRepository, followRequestRepository, userRepository }: ListFollowingDeps): ListFollowing =>
  async ({ userId, cursor, limit }) => {
    const page = await followRepository.listByFollower(userId, cursor, limit);
    const followeeIds = page.items.map((record) => record.followeeId);

    const [followees, relationships] = await Promise.all([
      Promise.all(followeeIds.map((id) => userRepository.findById(id))),
      resolveRelationships(userId, followeeIds, { followRepository, followRequestRepository }),
    ]);

    return {
      items: page.items.map((record, index) => {
        const followee = followees[index];
        const relationship = relationships.get(record.followeeId) ?? {
          followState: 'none' as const,
          followsYou: false,
        };
        return {
          userId: record.followeeId,
          handle: followee?.handle ?? '',
          displayName: followee?.displayName ?? '',
          createdAt: record.createdAt.toISOString(),
          followState: relationship.followState,
          followsYou: relationship.followsYou,
        };
      }),
      nextCursor: page.nextCursor,
    };
  };
