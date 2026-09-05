import type { Clock } from '../../container/cradle';
import type { NotificationRepository } from '../../repositories/notifications';

export type MarkAllNotificationsRead = (userId: string) => Promise<void>;

export interface MarkAllNotificationsReadDeps {
  notificationRepository: NotificationRepository;
  clock: Clock;
}

/** Marks every unread notification of the caller as read; idempotent (RF-014, RF-015). */
export const makeMarkAllNotificationsRead =
  ({ notificationRepository, clock }: MarkAllNotificationsReadDeps): MarkAllNotificationsRead =>
  async (userId) => {
    await notificationRepository.markAllRead(userId, clock.now());
  };
