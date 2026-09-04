import type { ReadingSessionRecord } from '../../repositories/reading-sessions';
import type { ReviewRecord } from '../../repositories/reviews';
import { toReviewDTO } from '../reviews';
import type { ReadingSessionDTO } from './types';

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
