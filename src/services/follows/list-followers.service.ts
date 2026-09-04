import type { FollowRepository } from '../../repositories/follows';
import type { UserRepository } from '../../repositories/users';
import type { FollowCursorPageDTO } from './types';

export interface ListFollowersInput {
  userId: string;
  cursor: string | null;
  limit: number;
}

export type ListFollowers = (input: ListFollowersInput) => Promise<FollowCursorPageDTO>;

export interface ListFollowersDeps {
  followRepository: FollowRepository;
  userRepository: UserRepository;
}

/** Lists my own approved followers (RF-018). Visible only to the owner (RF-020). */
export const makeListFollowers =
  ({ followRepository, userRepository }: ListFollowersDeps): ListFollowers =>
  async ({ userId, cursor, limit }) => {
    const page = await followRepository.listByFollowee(userId, cursor, limit);

    const followers = await Promise.all(
      page.items.map((record) => userRepository.findById(record.followerId)),
    );

    return {
      items: page.items.map((record, index) => {
        const follower = followers[index];
        return {
          userId: record.followerId,
          handle: follower?.handle ?? '',
          displayName: follower?.displayName ?? '',
          createdAt: record.createdAt.toISOString(),
        };
      }),
      nextCursor: page.nextCursor,
    };
  };
