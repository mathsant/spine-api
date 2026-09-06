import type { ActivityRepository } from '../../repositories/activities';
import type { BookRepository } from '../../repositories/books';
import type { FollowRepository } from '../../repositories/follows';
import type { ReactionRepository } from '../../repositories/reactions';
import type { ReviewRepository } from '../../repositories/reviews';
import type { UserRepository } from '../../repositories/users';
import { hydrateActivities } from './hydrate-activities';
import type { FeedCursorPageDTO } from './types';

export interface GetFeedInput {
  userId: string;
  cursor: string | null;
  limit: number;
}

export type GetFeed = (input: GetFeedInput) => Promise<FeedCursorPageDTO>;

export interface GetFeedDeps {
  activityRepository: ActivityRepository;
  followRepository: FollowRepository;
  userRepository: UserRepository;
  bookRepository: BookRepository;
  reviewRepository: ReviewRepository;
  reactionRepository: ReactionRepository;
}

/**
 * Activity feed: the user's own activity mixed with everyone they approved-follow
 * (RF-006, RF-008), fan-out on read (D6 of research.md). `review_published` items
 * resolve the review's current content live (RF-009) — never a stale snapshot.
 */
export const makeGetFeed =
  ({
    activityRepository,
    followRepository,
    userRepository,
    bookRepository,
    reviewRepository,
    reactionRepository,
  }: GetFeedDeps): GetFeed =>
  async ({ userId, cursor, limit }) => {
    const followeeIds = await followRepository.listFolloweeIds(userId);
    const page = await activityRepository.listForActors([userId, ...followeeIds], cursor, limit);

    return hydrateActivities(userId, page, {
      userRepository,
      bookRepository,
      reviewRepository,
      reactionRepository,
    });
  };
