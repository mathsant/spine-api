import type { ReviewDTO } from '../reviews';

export interface ReadingSessionDTO {
  id: string;
  bookId: string;
  status: 'reading' | 'finished';
  startedAt: string | null;
  finishedAt: string | null;
  currentPage: number | null;
  createdAt: string;
  review: ReviewDTO | null;
}

export interface ReadingSessionCursorPageDTO {
  items: ReadingSessionDTO[];
  nextCursor: string | null;
}

/** Compact book projection embedded in each item of `GET /me/reading-sessions`
 * (feature 010). Only the listing carries it — other reading-session responses
 * stay as `ReadingSessionDTO`. `olid` makes the row navigable to `GET /books/{olid}`
 * (the session's own `bookId` is the internal id, which has no lookup route). */
export interface ReadingSessionBookDTO {
  olid: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  pageCount: number | null;
}

export interface ReadingSessionListItemDTO extends ReadingSessionDTO {
  book: ReadingSessionBookDTO;
}

export interface ReadingSessionListCursorPageDTO {
  items: ReadingSessionListItemDTO[];
  nextCursor: string | null;
}
