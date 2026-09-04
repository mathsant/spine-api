import { ReadingSessionNotFinishedError, ReadingSessionNotFoundError, ReviewAlreadyExistsError } from '../../errors';
import type { ReadingSessionRepository } from '../../repositories/reading-sessions';
import type { ReviewRepository } from '../../repositories/reviews';
import { toReviewDTO } from './to-dto';
import type { ReviewDTO } from './types';

export interface CreateReviewInput {
  userId: string;
  sessionId: string;
  rating: number;
  text?: string | null;
  containsSpoiler?: boolean;
}

export type CreateReview = (input: CreateReviewInput) => Promise<ReviewDTO>;

export interface CreateReviewDeps {
  reviewRepository: ReviewRepository;
  readingSessionRepository: ReadingSessionRepository;
}

/** Creates a review for a finished reading session owned by the user (RF-001). */
export const makeCreateReview =
  ({ reviewRepository, readingSessionRepository }: CreateReviewDeps): CreateReview =>
  async ({ userId, sessionId, rating, text, containsSpoiler }) => {
    const session = await readingSessionRepository.findById(sessionId);
    if (!session || session.userId !== userId) {
      throw new ReadingSessionNotFoundError();
    }
    if (session.status !== 'finished') {
      throw new ReadingSessionNotFinishedError();
    }

    const existing = await reviewRepository.findBySessionId(sessionId);
    if (existing) {
      throw new ReviewAlreadyExistsError();
    }

    const record = await reviewRepository.create(userId, sessionId, session.bookId, {
      rating,
      text,
      containsSpoiler,
    });
    return toReviewDTO(record);
  };
