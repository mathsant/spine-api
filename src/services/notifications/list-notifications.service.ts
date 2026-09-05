import type { NotificationRepository } from '../../repositories/notifications';
import { toNotificationDTO } from './to-dto';
import type { NotificationCursorPageDTO } from './types';

export interface ListNotificationsInput {
  userId: string;
  cursor: string | null;
  limit: number;
}

export type ListNotifications = (input: ListNotificationsInput) => Promise<NotificationCursorPageDTO>;

export interface ListNotificationsDeps {
  notificationRepository: NotificationRepository;
}

/** Lists the caller's own notifications, paginated by cursor, newest first (RF-011, RF-012). */
export const makeListNotifications =
  ({ notificationRepository }: ListNotificationsDeps): ListNotifications =>
  async ({ userId, cursor, limit }) => {
    const page = await notificationRepository.listByRecipient(userId, cursor, limit);

    return {
      items: page.items.map(toNotificationDTO),
      nextCursor: page.nextCursor,
    };
  };
