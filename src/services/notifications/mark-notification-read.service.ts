import type { Clock } from '../../container/cradle';
import { NotificationNotFoundError } from '../../errors';
import type { NotificationRepository } from '../../repositories/notifications';

export interface MarkNotificationReadInput {
  userId: string;
  notificationId: string;
}

export type MarkNotificationRead = (input: MarkNotificationReadInput) => Promise<void>;

export interface MarkNotificationReadDeps {
  notificationRepository: NotificationRepository;
  clock: Clock;
}

/**
 * Marks the caller's own notification as read (RF-012, RF-013). Idempotent — marking an
 * already-read notification again is a no-op that preserves the original `readAt` (RF-015).
 */
export const makeMarkNotificationRead =
  ({ notificationRepository, clock }: MarkNotificationReadDeps): MarkNotificationRead =>
  async ({ userId, notificationId }) => {
    const existing = await notificationRepository.findById(notificationId);
    if (!existing || existing.recipientId !== userId) {
      throw new NotificationNotFoundError();
    }

    if (existing.readAt !== null) {
      return;
    }

    await notificationRepository.markRead(notificationId, clock.now());
  };
