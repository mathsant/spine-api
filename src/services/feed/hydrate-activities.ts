import type { ActivityRecord } from '../../repositories/activities';
import type { BookRepository } from '../../repositories/books';
import type { ReactionRepository } from '../../repositories/reactions';
import type { ReviewRepository } from '../../repositories/reviews';
import type { CursorPage } from '../../repositories/shelf-memberships';
import type { UserRepository } from '../../repositories/users';
import { toFeedItemDTO } from './to-dto';
import type { FeedCursorPageDTO } from './types';

export interface HydrateActivitiesDeps {
  userRepository: UserRepository;
  bookRepository: BookRepository;
  reviewRepository: ReviewRepository;
  reactionRepository: ReactionRepository;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Resolves a page of activity records into feed-item DTOs: actors, books, live review
 * content, reaction counts and the viewer's own reactions — all batched, no N+1. Shared
 * by `GET /feed` and `GET /users/:userId/activity` so both serve the identical item shape.
 * `review_published` items carry the review's current state (live, never a snapshot).
 */
export async function hydrateActivities(
  viewerId: string,
  page: CursorPage<ActivityRecord>,
  { userRepository, bookRepository, reviewRepository, reactionRepository }: HydrateActivitiesDeps,
): Promise<FeedCursorPageDTO> {
  const actorIds = unique(page.items.map((item) => item.actorId));
  const bookIds = unique(page.items.map((item) => item.bookId));
  const activityIds = page.items.map((item) => item.id);
  const reviewSessionIds = page.items
    .filter((item) => item.type === 'review_published')
    .map((item) => item.readingSessionId);

  const [actors, books, reviews, reactionCounts, reactedActivityIds] = await Promise.all([
    Promise.all(actorIds.map((id) => userRepository.findById(id))),
    Promise.all(bookIds.map((id) => bookRepository.findById(id))),
    reviewRepository.findBySessionIds(reviewSessionIds),
    reactionRepository.countByActivityIds(activityIds),
    reactionRepository.listReactedActivityIds(viewerId, activityIds),
  ]);

  const actorById = new Map(actorIds.map((id, index) => [id, actors[index] ?? undefined]));
  const bookById = new Map(bookIds.map((id, index) => [id, books[index] ?? undefined]));
  const reviewBySessionId = new Map(reviews.map((review) => [review.sessionId, review]));
  const reactedSet = new Set(reactedActivityIds);

  return {
    items: page.items.map((activity) =>
      toFeedItemDTO(
        activity,
        actorById.get(activity.actorId) ?? undefined,
        bookById.get(activity.bookId) ?? undefined,
        reviewBySessionId.get(activity.readingSessionId) ?? null,
        reactionCounts.get(activity.id) ?? 0,
        reactedSet.has(activity.id),
      ),
    ),
    nextCursor: page.nextCursor,
  };
}
