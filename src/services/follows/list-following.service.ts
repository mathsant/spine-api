import type { FollowRepository } from '../../repositories/follows';
import type { UserRepository } from '../../repositories/users';
import type { FollowCursorPageDTO } from './types';

export interface ListFollowingInput {
  userId: string;
  cursor: string | null;
  limit: number;
}

export type ListFollowing = (input: ListFollowingInput) => Promise<FollowCursorPageDTO>;

export interface ListFollowingDeps {
  followRepository: FollowRepository;
  userRepository: UserRepository;
}

/** Lists who I own approved-follow (RF-019). Visible only to the owner (RF-020). */
export const makeListFollowing =
  ({ followRepository, userRepository }: ListFollowingDeps): ListFollowing =>
  async ({ userId, cursor, limit }) => {
    const page = await followRepository.listByFollower(userId, cursor, limit);

    const followees = await Promise.all(
      page.items.map((record) => userRepository.findById(record.followeeId)),
    );

    return {
      items: page.items.map((record, index) => {
        const followee = followees[index];
        return {
          userId: record.followeeId,
          handle: followee?.handle ?? '',
          displayName: followee?.displayName ?? '',
          createdAt: record.createdAt.toISOString(),
        };
      }),
      nextCursor: page.nextCursor,
    };
  };
