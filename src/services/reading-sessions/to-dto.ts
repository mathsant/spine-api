import type { BookRecord } from '../../repositories/books';
import type { ReadingSessionRecord } from '../../repositories/reading-sessions';
import type { ReviewRecord } from '../../repositories/reviews';
import { toReviewDTO } from '../reviews';
import type { ReadingSessionBookDTO, ReadingSessionDTO, ReadingSessionListItemDTO } from './types';

export function toReadingSessionDTO(
  record: ReadingSessionRecord,
  review: ReviewRecord | null = null,
): ReadingSessionDTO {
  return {
    id: record.id,
    bookId: record.bookId,
    status: record.status,
    startedAt: record.startedAt ? record.startedAt.toISOString() : null,
    finishedAt: record.finishedAt ? record.finishedAt.toISOString() : null,
    currentPage: record.currentPage,
    createdAt: record.createdAt.toISOString(),
    review: review ? toReviewDTO(review) : null,
  };
}

function toReadingSessionBookDTO(book: BookRecord | undefined): ReadingSessionBookDTO {
  return {
    olid: book?.olid ?? '',
    title: book?.title ?? '',
    authors: book?.authors ?? [],
    coverUrl: book?.coverUrl ?? null,
    pageCount: book?.pageCount ?? null,
  };
}

/** List-only variant (feature 010): `ReadingSessionDTO` plus an embedded `book` summary. */
export function toReadingSessionListItemDTO(
  record: ReadingSessionRecord,
  review: ReviewRecord | null,
  book: BookRecord | undefined,
): ReadingSessionListItemDTO {
  return {
    ...toReadingSessionDTO(record, review),
    book: toReadingSessionBookDTO(book),
  };
}
