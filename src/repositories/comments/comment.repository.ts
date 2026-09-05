import type { ActivityType } from '../activities';
import type { CursorPage } from '../shelf-memberships';

/** Persisted shape of a comment on a feed item, with the Mongo `_id` surfaced as `id`. */
export interface CommentRecord {
  id: string;
  activityId: string;
  readingSessionId: string;
  activityType: ActivityType;
  authorId: string;
  text: string;
  parentCommentId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
}

export interface CreateCommentInput {
  activityId: string;
  readingSessionId: string;
  activityType: ActivityType;
  authorId: string;
  text: string;
  parentCommentId?: string | null;
}

/** Data-access port for the `comments` collection. */
export interface CommentRepository {
  create(input: CreateCommentInput, now: Date): Promise<CommentRecord>;

  /** Resolves a comment (e.g. a `parentCommentId`) or checks ownership before a soft delete. */
  findById(commentId: string): Promise<CommentRecord | null>;

  /** Cursor page ordered ASCENDING by `createdAt`/`_id` (007, D5 of research.md). */
  listByActivity(activityId: string, cursor: string | null, limit: number): Promise<CursorPage<CommentRecord>>;

  /** `$set` of `deletedAt`; the persisted `text` is untouched (RF-009). */
  softDelete(commentId: string, deletedAt: Date): Promise<CommentRecord | null>;

  /** Removes every comment of a session, any `activityType` — cascade of `delete-reading-session` (RF-013). */
  deleteByReadingSessionId(readingSessionId: string): Promise<void>;

  /** Removes only the given type's comments of a session — cascade of `delete-review` (RF-013). */
  deleteByReadingSessionIdAndType(readingSessionId: string, activityType: ActivityType): Promise<void>;
}
