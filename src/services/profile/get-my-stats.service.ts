import type { FollowRequestRepository } from '../../repositories/follow-requests';
import type { FollowRepository } from '../../repositories/follows';
import type { ReadingSessionRepository } from '../../repositories/reading-sessions';
import type { ShelfMembershipRepository } from '../../repositories/shelf-memberships';
import type { MyStatsDTO } from './types';

export interface GetMyStatsInput {
  userId: string;
}

export type GetMyStats = (input: GetMyStatsInput) => Promise<MyStatsDTO>;

export interface GetMyStatsDeps {
  readingSessionRepository: ReadingSessionRepository;
  followRepository: FollowRepository;
  followRequestRepository: FollowRequestRepository;
  shelfMembershipRepository: ShelfMembershipRepository;
}

/**
 * Summary counters for the caller's own profile screen (011 — D3). `GET /me` is not
 * touched — these live only here. Every counter is a single indexed count/distinct.
 */
export const makeGetMyStats =
  ({
    readingSessionRepository,
    followRepository,
    followRequestRepository,
    shelfMembershipRepository,
  }: GetMyStatsDeps): GetMyStats =>
  async ({ userId }) => {
    const [booksRead, followers, following, pendingFollowRequests, wantToRead] = await Promise.all([
      readingSessionRepository.countDistinctFinishedBooks(userId),
      followRepository.countFollowers(userId),
      followRepository.countFollowing(userId),
      followRequestRepository.countIncoming(userId),
      shelfMembershipRepository.countForUser(userId),
    ]);

    return { booksRead, followers, following, pendingFollowRequests, wantToRead };
  };
