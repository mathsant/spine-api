import type { ActivityType } from '../activities';
import type { CursorPage } from '../shelf-memberships';

export type NotificationType =
  | 'follow_request'
  | 'follow_approved'
  | 'comment_on_content'
  | 'comment_reply'
  | 'reaction_on_content';

/** Persisted shape of a notification, with the Mongo `_id` surfaced as `id`. */
export interface NotificationRecord {
  id: string;
  recipientId: string;
  type: NotificationType;
  actorId: string;
  activityId: string | null;
  commentId: string | null;
  readingSessionId: string | null;
  activityType: ActivityType | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface CreateNotificationRecordInput {
  recipientId: string;
  type: NotificationType;
  actorId: string;
  activityId?: string | null;
  commentId?: string | null;
  readingSessionId?: string | null;
  activityType?: ActivityType | null;
}

/** Data-access port for the `notifications` collection. */
export interface NotificationRepository {
  create(input: CreateNotificationRecordInput, now: Date): Promise<NotificationRecord>;

  /** Used by `mark-notification-read` to check ownership and current `readAt` (RF-012, RF-015). */
  findById(notificationId: string): Promise<NotificationRecord | null>;

  /** Cursor page ordered DESCENDING by `createdAt`/`_id` — newest first (RF-011). */
  listByRecipient(recipientId: string, cursor: string | null, limit: number): Promise<CursorPage<NotificationRecord>>;

  /** `$set` of `readAt`. Idempotency is the caller service's responsibility (RF-015). */
  markRead(notificationId: string, readAt: Date): Promise<void>;

  /** `updateMany({ recipientId, readAt: null })`; returns how many documents were updated. */
  markAllRead(recipientId: string, readAt: Date): Promise<number>;

  /** `countDocuments({ recipientId, readAt: null })` (RF-016). */
  countUnread(recipientId: string): Promise<number>;

  /** Removes the `follow_request` notification for this pair (RF-004, D2 of research.md). */
  deleteFollowRequestNotification(recipientId: string, actorId: string): Promise<void>;

  /** Removes the `reaction_on_content` notification for this key (RF-010, D2 of research.md). */
  deleteReactionNotification(activityId: string, actorId: string): Promise<void>;

  /** Removes every notification tied to this comment (RF-010, D6 of research.md). */
  deleteByCommentId(commentId: string): Promise<void>;

  /** Removes every notification of a session, any `activityType` — cascade (RF-010, D5). */
  deleteByReadingSessionId(readingSessionId: string): Promise<void>;

  /** Removes only the given type's notifications of a session — cascade (RF-010, D5). */
  deleteByReadingSessionIdAndType(readingSessionId: string, activityType: ActivityType): Promise<void>;
}
