import { FollowNotFoundError } from '../../errors';
import type { FollowRepository } from '../../repositories/follows';

export interface UnfollowInput {
  followerId: string;
  followeeId: string;
}

export type Unfollow = (input: UnfollowInput) => Promise<void>;

export interface UnfollowDeps {
  followRepository: FollowRepository;
}

/** Unfollows someone I follow (RF-014). */
export const makeUnfollow =
  ({ followRepository }: UnfollowDeps): Unfollow =>
  async ({ followerId, followeeId }) => {
    const deleted = await followRepository.deleteByPair(followerId, followeeId);
    if (!deleted) {
      throw new FollowNotFoundError();
    }
  };
