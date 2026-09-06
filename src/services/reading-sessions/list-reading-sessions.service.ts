import type { ReadingSessionRepository } from '../../repositories/reading-sessions';
import type { ReviewRepository } from '../../repositories/reviews';
import { toReadingSessionDTO } from './to-dto';
import type { ReadingSessionCursorPageDTO } from './types';

export interface ListReadingSessionsInput {
  userId: string;
  bookId?: string;
  status?: 'reading' | 'finished';
  cursor: string | null;
  limit: number;
}

export type ListReadingSessions = (input: ListReadingSessionsInput) => Promise<ReadingSessionCursorPageDTO>;

export interface ListReadingSessionsDeps {
  readingSessionRepository: ReadingSessionRepository;
  reviewRepository: ReviewRepository;
}

/**
 * Paginated history of the user's own reading sessions, optionally filtered by book
 * (RF-019). Embeds each session's review, if any, via a single batch lookup (RF-010, D5).
 */
export const makeListReadingSessions =
  ({ readingSessionRepository, reviewRepository }: ListReadingSessionsDeps): ListReadingSessions =>
  async ({ userId, bookId, status, cursor, limit }) => {
    const page = await readingSessionRepository.listByUser(userId, { bookId, status }, cursor, limit);

    const reviews = await reviewRepository.findBySessionIds(page.items.map((session) => session.id));
    const reviewBySessionId = new Map(reviews.map((review) => [review.sessionId, review]));

    return {
      items: page.items.map((session) => toReadingSessionDTO(session, reviewBySessionId.get(session.id) ?? null)),
      nextCursor: page.nextCursor,
    };
  };
