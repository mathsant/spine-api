import type { BookRepository } from '../../repositories/books';
import type { ReadingSessionRepository } from '../../repositories/reading-sessions';
import type { ReviewRepository } from '../../repositories/reviews';
import { toReadingSessionListItemDTO } from './to-dto';
import type { ReadingSessionListCursorPageDTO } from './types';

export interface ListReadingSessionsInput {
  userId: string;
  bookId?: string;
  status?: 'reading' | 'finished';
  cursor: string | null;
  limit: number;
}

export type ListReadingSessions = (
  input: ListReadingSessionsInput,
) => Promise<ReadingSessionListCursorPageDTO>;

export interface ListReadingSessionsDeps {
  readingSessionRepository: ReadingSessionRepository;
  reviewRepository: ReviewRepository;
  bookRepository: BookRepository;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Paginated history of the user's own reading sessions, optionally filtered by book
 * and/or `status` (RF-019, RF-021). Without a `status` filter the list is ordered with
 * `reading` sessions before `finished` ones, then `createdAt` desc (RF-023). Each item
 * embeds its review, if any, and a compact `book` summary — both resolved via a single
 * batch lookup, never one query per item (RF-028, RF-030, D5).
 */
export const makeListReadingSessions =
  ({
    readingSessionRepository,
    reviewRepository,
    bookRepository,
  }: ListReadingSessionsDeps): ListReadingSessions =>
  async ({ userId, bookId, status, cursor, limit }) => {
    const page = await readingSessionRepository.listByUser(userId, { bookId, status }, cursor, limit);

    const reviews = await reviewRepository.findBySessionIds(page.items.map((session) => session.id));
    const reviewBySessionId = new Map(reviews.map((review) => [review.sessionId, review]));

    const bookIds = unique(page.items.map((session) => session.bookId));
    const books = await Promise.all(bookIds.map((id) => bookRepository.findById(id)));
    const bookById = new Map(bookIds.map((id, index) => [id, books[index] ?? undefined]));

    return {
      items: page.items.map((session) =>
        toReadingSessionListItemDTO(
          session,
          reviewBySessionId.get(session.id) ?? null,
          bookById.get(session.bookId) ?? undefined,
        ),
      ),
      nextCursor: page.nextCursor,
    };
  };
