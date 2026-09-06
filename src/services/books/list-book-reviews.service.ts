import { decodeCursor, encodeCursor } from '../../lib';
import type { OpenLibraryClient } from '../../integrations/open-library';
import type { BookRepository } from '../../repositories/books';
import type { FollowRepository } from '../../repositories/follows';
import type { ReadingSessionRepository } from '../../repositories/reading-sessions';
import type { ReviewRecord, ReviewRepository } from '../../repositories/reviews';
import type { UserRecord, UserRepository } from '../../repositories/users';
import { resolveBook } from './resolve-book';
import type { BookReviewByFollowingCursorPageDTO, BookReviewByFollowingDTO } from './types';

export interface ListBookReviewsInput {
  userId: string;
  olid: string;
  cursor: string | null;
  limit: number;
}

export type ListBookReviews = (
  input: ListBookReviewsInput,
) => Promise<BookReviewByFollowingCursorPageDTO>;

export interface ListBookReviewsDeps {
  bookRepository: BookRepository;
  openLibraryClient: OpenLibraryClient;
  followRepository: FollowRepository;
  readingSessionRepository: ReadingSessionRepository;
  reviewRepository: ReviewRepository;
  userRepository: UserRepository;
}

function toDTO(review: ReviewRecord, author: UserRecord | undefined): BookReviewByFollowingDTO {
  return {
    reviewId: review.id,
    author: {
      userId: review.userId,
      handle: author?.handle ?? '',
      displayName: author?.displayName ?? '',
      avatarUrl: null,
    },
    rating: review.rating,
    text: review.text,
    containsSpoiler: review.containsSpoiler,
    createdAt: review.createdAt.toISOString(),
  };
}

/** Comes after `cursor` under a `createdAt` desc, then `id` desc ordering. */
function isAfterCursor(review: ReviewRecord, cursorCreatedAt: string, cursorId: string): boolean {
  const createdAt = review.createdAt.toISOString();
  if (createdAt !== cursorCreatedAt) {
    return createdAt < cursorCreatedAt;
  }
  return review.id < cursorId;
}

/**
 * Reviews of a book made by users the caller follows with an approved follow (P6).
 * At most one review per followed user: the one attached to that user's most recent
 * `finished` session of the book (feature 010, RF-006..012). The caller's own review
 * is never included. Ordered by review `createdAt` desc, cursor-paginated.
 */
export const makeListBookReviews =
  ({
    bookRepository,
    openLibraryClient,
    followRepository,
    readingSessionRepository,
    reviewRepository,
    userRepository,
  }: ListBookReviewsDeps): ListBookReviews =>
  async ({ userId, olid, cursor, limit }) => {
    const book = await resolveBook({ bookRepository, openLibraryClient }, olid);

    const followeeIds = (await followRepository.listFolloweeIds(userId)).filter((id) => id !== userId);
    if (followeeIds.length === 0) {
      return { items: [], nextCursor: null };
    }

    const sessions = await readingSessionRepository.findLatestFinishedPerUserForBook(
      book.id,
      followeeIds,
    );
    if (sessions.length === 0) {
      return { items: [], nextCursor: null };
    }

    const reviews = await reviewRepository.findBySessionIds(sessions.map((session) => session.id));
    const sessionIds = new Set(sessions.map((session) => session.id));
    const relevantReviews = reviews.filter((review) => sessionIds.has(review.sessionId));

    const authorIds = [...new Set(relevantReviews.map((review) => review.userId))];
    const authors = await Promise.all(authorIds.map((id) => userRepository.findById(id)));
    const authorById = new Map(authorIds.map((id, index) => [id, authors[index] ?? undefined]));

    const ordered = relevantReviews.sort((a, b) => {
      const byDate = b.createdAt.getTime() - a.createdAt.getTime();
      return byDate !== 0 ? byDate : (a.id < b.id ? 1 : -1);
    });

    const afterCursor =
      cursor === null
        ? ordered
        : (() => {
            const { createdAt, id } = decodeCursor(cursor);
            return ordered.filter((review) => isAfterCursor(review, createdAt, id));
          })();

    const page = afterCursor.slice(0, limit);
    const hasMore = afterCursor.length > limit;
    const last = page.at(-1);

    return {
      items: page.map((review) => toDTO(review, authorById.get(review.userId))),
      nextCursor:
        hasMore && last
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  };
