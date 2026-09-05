import type { NotificationType } from '../../repositories/notifications';

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  actorId: string;
  activityId: string | null;
  commentId: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationCursorPageDTO {
  items: NotificationDTO[];
  nextCursor: string | null;
}

export interface UnreadNotificationCountDTO {
  count: number;
}
