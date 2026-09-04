import { ReviewNotFoundError } from '../../errors';
import type { ReviewRepository } from '../../repositories/reviews';

export interface DeleteReviewInput {
  userId: string;
  reviewId: string;
}

export type DeleteReview = (input: DeleteReviewInput) => Promise<void>;

export interface DeleteReviewDeps {
  reviewRepository: ReviewRepository;
}

/** Deletes a review owned by the user (RF-006). Ownership checked here (D7/D9). */
export const makeDeleteReview =
  ({ reviewRepository }: DeleteReviewDeps): DeleteReview =>
  async ({ userId, reviewId }) => {
    const existing = await reviewRepository.findById(reviewId);
    if (!existing || existing.userId !== userId) {
      throw new ReviewNotFoundError();
    }

    await reviewRepository.delete(reviewId);
  };
