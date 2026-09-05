import type { NotificationRecord } from '../../repositories/notifications';
import type { NotificationDTO } from './types';

export function toNotificationDTO(notification: NotificationRecord): NotificationDTO {
  return {
    id: notification.id,
    type: notification.type,
    actorId: notification.actorId,
    activityId: notification.activityId,
    commentId: notification.commentId,
    read: notification.readAt !== null,
    createdAt: notification.createdAt.toISOString(),
  };
}
