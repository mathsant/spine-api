import { ReviewNotFoundError } from '../../errors';
import type { ActivityRepository } from '../../repositories/activities';
import type { CommentRepository } from '../../repositories/comments';
import type { ReactionRepository } from '../../repositories/reactions';
import type { ReviewRepository } from '../../repositories/reviews';

export interface DeleteReviewInput {
  userId: string;
  reviewId: string;
}

export type DeleteReview = (input: DeleteReviewInput) => Promise<void>;

export interface DeleteReviewDeps {
  reviewRepository: ReviewRepository;
  activityRepository: ActivityRepository;
  commentRepository: CommentRepository;
  reactionRepository: ReactionRepository;
}

/**
 * Deletes a review owned by the user (RF-006). Ownership checked here (D7/D9). Cascades the
 * delete to the session's `review_published` activity event only — other event types of the
 * same session (e.g. `started_reading`) are untouched (006, D4 of research.md) — and to the
 * comments/reactions of that same event (007, RF-013).
 */
export const makeDeleteReview =
  ({ reviewRepository, activityRepository, commentRepository, reactionRepository }: DeleteReviewDeps): DeleteReview =>
  async ({ userId, reviewId }) => {
    const existing = await reviewRepository.findById(reviewId);
    if (!existing || existing.userId !== userId) {
      throw new ReviewNotFoundError();
    }

    await reviewRepository.delete(reviewId);
    await activityRepository.deleteBySessionIdAndType(existing.sessionId, 'review_published');
    await commentRepository.deleteByReadingSessionIdAndType(existing.sessionId, 'review_published');
    await reactionRepository.deleteByReadingSessionIdAndType(existing.sessionId, 'review_published');
  };
