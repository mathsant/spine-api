import type { ReviewRecord } from '../../repositories/reviews';
import type { ReviewDTO } from './types';

export function toReviewDTO(record: ReviewRecord): ReviewDTO {
  return {
    id: record.id,
    sessionId: record.sessionId,
    rating: record.rating,
    text: record.text,
    containsSpoiler: record.containsSpoiler,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
