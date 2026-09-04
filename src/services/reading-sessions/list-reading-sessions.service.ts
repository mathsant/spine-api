import type { ReadingSessionRepository } from '../../repositories/reading-sessions';
import { toReadingSessionDTO } from './to-dto';
import type { ReadingSessionCursorPageDTO } from './types';

export interface ListReadingSessionsInput {
  userId: string;
  bookId?: string;
  cursor: string | null;
  limit: number;
}

export type ListReadingSessions = (input: ListReadingSessionsInput) => Promise<ReadingSessionCursorPageDTO>;

export interface ListReadingSessionsDeps {
  readingSessionRepository: ReadingSessionRepository;
}

/** Paginated history of the user's own reading sessions, optionally filtered by book (RF-019). */
export const makeListReadingSessions =
  ({ readingSessionRepository }: ListReadingSessionsDeps): ListReadingSessions =>
  async ({ userId, bookId, cursor, limit }) => {
    const page = await readingSessionRepository.listByUser(userId, { bookId }, cursor, limit);

    return {
      items: page.items.map(toReadingSessionDTO),
      nextCursor: page.nextCursor,
    };
  };
