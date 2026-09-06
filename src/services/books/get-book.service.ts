import type { OpenLibraryClient } from '../../integrations/open-library';
import type { BookRecord, BookRepository } from '../../repositories/books';
import type { ReadingSessionRepository } from '../../repositories/reading-sessions';
import type { ReviewAggregates, ReviewRepository } from '../../repositories/reviews';
import { resolveBook } from './resolve-book';
import type { BookDetailDTO } from './types';

export interface GetBookInput {
  olid: string;
}

export type GetBook = (input: GetBookInput) => Promise<BookDetailDTO>;

export interface GetBookDeps {
  bookRepository: BookRepository;
  openLibraryClient: OpenLibraryClient;
  readingSessionRepository: ReadingSessionRepository;
  reviewRepository: ReviewRepository;
}

function toDTO(book: BookRecord, reviewAggregates: ReviewAggregates, readerCount: number): BookDetailDTO {
  return {
    id: book.id,
    olid: book.olid,
    isbn13: book.isbn13,
    title: book.title,
    authors: book.authors,
    coverUrl: book.coverUrl,
    firstPublishYear: book.firstPublishYear,
    pageCount: book.pageCount,
    aggregates: {
      averageRating: reviewAggregates.averageRating,
      reviewCount: reviewAggregates.reviewCount,
      readerCount,
    },
  };
}

/**
 * Cache-on-read: resolves the book from the local cache, or from Open Library on a
 * cache miss (caching it for next time — RF-003, RF-004). `averageRating`/`reviewCount`
 * reflect the real reviews of the book (RF-009); `readerCount` is derived live from
 * `reading_sessions`.
 */
export const makeGetBook =
  ({ bookRepository, openLibraryClient, readingSessionRepository, reviewRepository }: GetBookDeps): GetBook =>
  async ({ olid }) => {
    const book = await resolveBook({ bookRepository, openLibraryClient }, olid);
    const [readerCount, reviewAggregates] = await Promise.all([
      readingSessionRepository.countDistinctFinishedReaders(book.id),
      reviewRepository.getAggregatesByBook(book.id),
    ]);
    return toDTO(book, reviewAggregates, readerCount);
  };
