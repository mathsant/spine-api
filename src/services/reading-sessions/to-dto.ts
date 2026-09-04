import type { ReadingSessionRecord } from '../../repositories/reading-sessions';
import type { ReadingSessionDTO } from './types';

export function toReadingSessionDTO(record: ReadingSessionRecord): ReadingSessionDTO {
  return {
    id: record.id,
    bookId: record.bookId,
    status: record.status,
    startedAt: record.startedAt ? record.startedAt.toISOString() : null,
    finishedAt: record.finishedAt ? record.finishedAt.toISOString() : null,
    currentPage: record.currentPage,
    createdAt: record.createdAt.toISOString(),
  };
}
