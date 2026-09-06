import { UserNotFoundError } from '../../errors';
import type { ActivityRepository } from '../../repositories/activities';
import type { BookRepository } from '../../repositories/books';
import type { FollowRepository } from '../../repositories/follows';
import type { ReactionRepository } from '../../repositories/reactions';
import type { ReviewRepository } from '../../repositories/reviews';
import type { UserRepository } from '../../repositories/users';
import { hydrateActivities } from '../feed';
import type { FeedCursorPageDTO } from '../feed';

export interface ListUserActivityInput {
  viewerId: string;
  userId: string;
  cursor: string | null;
  limit: number;
}

export type ListUserActivity = (input: ListUserActivityInput) => Promise<FeedCursorPageDTO>;

export interface ListUserActivityDeps {
  activityRepository: ActivityRepository;
  followRepository: FollowRepository;
  userRepository: UserRepository;
  bookRepository: BookRepository;
  reviewRepository: ReviewRepository;
  reactionRepository: ReactionRepository;
}

/**
 * Recent activity of a single person (011 — D2), same item shape as `GET /feed`. Visible
 * only when the viewer approved-follows the target, or is the target. Every other case —
 * not following, pending, rejected, nonexistent, malformed id — is the same neutral
 * `UserNotFoundError` as `GET /users/:userId` (never `403`).
 */
export const makeListUserActivity =
  ({
    activityRepository,
    followRepository,
    userRepository,
    bookRepository,
    reviewRepository,
    reactionRepository,
  }: ListUserActivityDeps): ListUserActivity =>
  async ({ viewerId, userId, cursor, limit }) => {
    const isSelf = userId === viewerId;
    if (!isSelf && !(await followRepository.exists(viewerId, userId))) {
      throw new UserNotFoundError();
    }

    const page = await activityRepository.listForActors([userId], cursor, limit);

    return hydrateActivities(viewerId, page, {
      userRepository,
      bookRepository,
      reviewRepository,
      reactionRepository,
    });
  };
