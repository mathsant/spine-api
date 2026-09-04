import type { OpenLibraryClient } from '../../integrations/open-library';
import type { BookRecord, BookRepository } from '../../repositories/books';
import type { ReadingSessionRepository } from '../../repositories/reading-sessions';
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
}

function toDTO(book: BookRecord, readerCount: number): BookDetailDTO {
  return {
    id: book.id,
    olid: book.olid,
    isbn13: book.isbn13,
    title: book.title,
    authors: book.authors,
    coverUrl: book.coverUrl,
    firstPublishYear: book.firstPublishYear,
    aggregates: { averageRating: null, reviewCount: 0, readerCount },
  };
}

/**
 * Cache-on-read: resolves the book from the local cache, or from Open Library on a
 * cache miss (caching it for next time — RF-003, RF-004). Review is out of scope, so
 * `averageRating`/`reviewCount` are always null/0; `readerCount` is derived live from
 * `reading_sessions`.
 */
export const makeGetBook =
  ({ bookRepository, openLibraryClient, readingSessionRepository }: GetBookDeps): GetBook =>
  async ({ olid }) => {
    const book = await resolveBook({ bookRepository, openLibraryClient }, olid);
    const readerCount = await readingSessionRepository.countDistinctFinishedReaders(book.id);
    return toDTO(book, readerCount);
  };
