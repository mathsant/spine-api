import { ReadingSessionNotFoundError } from '../../errors';
import type { ActivityRepository } from '../../repositories/activities';
import type { CommentRepository } from '../../repositories/comments';
import type { ReactionRepository } from '../../repositories/reactions';
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
  activityRepository: ActivityRepository;
  commentRepository: CommentRepository;
  reactionRepository: ReactionRepository;
}

/**
 * Deletes a reading session (RF-018). Ownership checked here (D9). Cascades the delete to
 * the session's review, if any (RF-007, 005-reviews), to every activity event logged for it
 * (006, D4 of research.md), and to every comment/reaction of those events (007, RF-013).
 */
export const makeDeleteReadingSession =
  ({
    readingSessionRepository,
    reviewRepository,
    activityRepository,
    commentRepository,
    reactionRepository,
  }: DeleteReadingSessionDeps): DeleteReadingSession =>
  async ({ userId, sessionId }) => {
    const existing = await readingSessionRepository.findById(sessionId);
    if (!existing || existing.userId !== userId) {
      throw new ReadingSessionNotFoundError();
    }

    await readingSessionRepository.delete(sessionId);
    await reviewRepository.deleteBySessionId(sessionId);
    await activityRepository.deleteBySessionId(sessionId);
    await commentRepository.deleteByReadingSessionId(sessionId);
    await reactionRepository.deleteByReadingSessionId(sessionId);
  };
