import type { ActivityRepository } from '../../repositories/activities';
import type { BookRepository } from '../../repositories/books';
import type { FollowRepository } from '../../repositories/follows';
import type { ReviewRepository } from '../../repositories/reviews';
import type { UserRepository } from '../../repositories/users';
import { toFeedItemDTO } from './to-dto';
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
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Activity feed: the user's own activity mixed with everyone they approved-follow
 * (RF-006, RF-008), fan-out on read (D6 of research.md). `review_published` items
 * resolve the review's current content live (RF-009) — never a stale snapshot.
 */
export const makeGetFeed =
  ({ activityRepository, followRepository, userRepository, bookRepository, reviewRepository }: GetFeedDeps): GetFeed =>
  async ({ userId, cursor, limit }) => {
    const followeeIds = await followRepository.listFolloweeIds(userId);
    const page = await activityRepository.listForActors([userId, ...followeeIds], cursor, limit);

    const actorIds = unique(page.items.map((item) => item.actorId));
    const bookIds = unique(page.items.map((item) => item.bookId));
    const reviewSessionIds = page.items
      .filter((item) => item.type === 'review_published')
      .map((item) => item.readingSessionId);

    const [actors, books, reviews] = await Promise.all([
      Promise.all(actorIds.map((id) => userRepository.findById(id))),
      Promise.all(bookIds.map((id) => bookRepository.findById(id))),
      reviewRepository.findBySessionIds(reviewSessionIds),
    ]);

    const actorById = new Map(actorIds.map((id, index) => [id, actors[index] ?? undefined]));
    const bookById = new Map(bookIds.map((id, index) => [id, books[index] ?? undefined]));
    const reviewBySessionId = new Map(reviews.map((review) => [review.sessionId, review]));

    return {
      items: page.items.map((activity) =>
        toFeedItemDTO(
          activity,
          actorById.get(activity.actorId) ?? undefined,
          bookById.get(activity.bookId) ?? undefined,
          reviewBySessionId.get(activity.readingSessionId) ?? null,
        ),
      ),
      nextCursor: page.nextCursor,
    };
  };
