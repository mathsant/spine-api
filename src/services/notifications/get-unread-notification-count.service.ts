import type { NotificationRepository } from '../../repositories/notifications';

export type GetUnreadNotificationCount = (userId: string) => Promise<number>;

export interface GetUnreadNotificationCountDeps {
  notificationRepository: NotificationRepository;
}

/** Counts the caller's unread notifications (RF-016). */
export const makeGetUnreadNotificationCount =
  ({ notificationRepository }: GetUnreadNotificationCountDeps): GetUnreadNotificationCount =>
  (userId) =>
    notificationRepository.countUnread(userId);
