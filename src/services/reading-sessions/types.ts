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
