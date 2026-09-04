import { ReadingSessionNotFoundError } from '../../errors';
import type { ReadingSessionRepository } from '../../repositories/reading-sessions';
import type { ReviewRepository } from '../../repositories/reviews';

export interface DeleteReadingSessionInput {
  userId: string;
  sessionId: string;
}

export type DeleteReadingSession = (input: DeleteReadingSessionInput) => Promise<void>;

export interface DeleteReadingSessionDeps {
  readingSessionRepository: ReadingSessionRepository;
  reviewRepository: ReviewRepository;
}

/**
 * Deletes a reading session (RF-018). Ownership checked here (D9). Cascades the delete to
 * the session's review, if any (RF-007, 005-reviews).
 */
export const makeDeleteReadingSession =
  ({ readingSessionRepository, reviewRepository }: DeleteReadingSessionDeps): DeleteReadingSession =>
  async ({ userId, sessionId }) => {
    const existing = await readingSessionRepository.findById(sessionId);
    if (!existing || existing.userId !== userId) {
      throw new ReadingSessionNotFoundError();
    }

    await readingSessionRepository.delete(sessionId);
    await reviewRepository.deleteBySessionId(sessionId);
  };
