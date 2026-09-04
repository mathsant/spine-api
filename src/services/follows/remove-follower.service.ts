import { FollowNotFoundError } from '../../errors';
import type { FollowRepository } from '../../repositories/follows';

export interface RemoveFollowerInput {
  followeeId: string;
  followerId: string;
}

export type RemoveFollower = (input: RemoveFollowerInput) => Promise<void>;

export interface RemoveFollowerDeps {
  followRepository: FollowRepository;
}

/** Removes a specific follower of mine (RF-015) — same effect as that follower unfollowing me. */
export const makeRemoveFollower =
  ({ followRepository }: RemoveFollowerDeps): RemoveFollower =>
  async ({ followeeId, followerId }) => {
    const deleted = await followRepository.deleteByPair(followerId, followeeId);
    if (!deleted) {
      throw new FollowNotFoundError();
    }
  };
