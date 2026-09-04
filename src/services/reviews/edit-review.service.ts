import { ReviewNotFoundError } from '../../errors';
import type { EditReviewInput as RepositoryEditReviewInput, ReviewRepository } from '../../repositories/reviews';
import { toReviewDTO } from './to-dto';
import type { ReviewDTO } from './types';

export interface EditReviewInput {
  userId: string;
  reviewId: string;
  patch: RepositoryEditReviewInput;
}

export type EditReview = (input: EditReviewInput) => Promise<ReviewDTO>;

export interface EditReviewDeps {
  reviewRepository: ReviewRepository;
}

/** Partially edits a review owned by the user (RF-005). */
export const makeEditReview =
  ({ reviewRepository }: EditReviewDeps): EditReview =>
  async ({ userId, reviewId, patch }) => {
    const existing = await reviewRepository.findById(reviewId);
    if (!existing || existing.userId !== userId) {
      throw new ReviewNotFoundError();
    }

    const record = await reviewRepository.edit(reviewId, patch);
    return toReviewDTO(record);
  };
