import type { ActivityRecord } from '../../repositories/activities';
import type { BookRecord } from '../../repositories/books';
import type { ReviewRecord } from '../../repositories/reviews';
import type { UserRecord } from '../../repositories/users';
import { toReviewDTO } from '../reviews';
import type { FeedItemDTO } from './types';

export function toFeedItemDTO(
  activity: ActivityRecord,
  actor: UserRecord | undefined,
  book: BookRecord | undefined,
  review: ReviewRecord | null,
  reactionsCount: number,
  hasReacted: boolean,
): FeedItemDTO {
  return {
    id: activity.id,
    type: activity.type,
    createdAt: activity.createdAt.toISOString(),
    actor: {
      userId: activity.actorId,
      handle: actor?.handle ?? '',
      displayName: actor?.displayName ?? '',
    },
    book: {
      id: activity.bookId,
      title: book?.title ?? '',
      authors: book?.authors ?? [],
      coverUrl: book?.coverUrl ?? null,
      firstPublishYear: book?.firstPublishYear ?? null,
      pageCount: book?.pageCount ?? null,
    },
    readingSessionId: activity.readingSessionId,
    currentPage: activity.type === 'progress_update' ? activity.currentPage : null,
    review: activity.type === 'review_published' && review ? toReviewDTO(review) : null,
    reactionsCount,
    hasReacted,
  };
}
