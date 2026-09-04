export interface ReadingSessionDTO {
  id: string;
  bookId: string;
  status: 'reading' | 'finished';
  startedAt: string | null;
  finishedAt: string | null;
  currentPage: number | null;
  createdAt: string;
}

export interface ReadingSessionCursorPageDTO {
  items: ReadingSessionDTO[];
  nextCursor: string | null;
}
