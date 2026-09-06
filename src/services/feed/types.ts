import type { ActivityType } from '../../repositories/activities';
import type { ReviewDTO } from '../reviews';

export interface FeedActorDTO {
  userId: string;
  handle: string;
  displayName: string;
}

export interface FeedBookDTO {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  firstPublishYear: number | null;
  pageCount: number | null;
}

export interface FeedItemDTO {
  id: string;
  type: ActivityType;
  createdAt: string;
  actor: FeedActorDTO;
  book: FeedBookDTO;
  readingSessionId: string;
  currentPage: number | null;
  review: ReviewDTO | null;
  reactionsCount: number;
  hasReacted: boolean;
}

export interface FeedCursorPageDTO {
  items: FeedItemDTO[];
  nextCursor: string | null;
}
