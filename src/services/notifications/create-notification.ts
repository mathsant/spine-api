import type { ActivityType } from '../../repositories/activities';
import type { NotificationRepository, NotificationType } from '../../repositories/notifications';
import type { Clock } from '../../container/cradle';

export interface CreateNotificationInput {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  activityId?: string | null;
  commentId?: string | null;
  readingSessionId?: string | null;
  activityType?: ActivityType | null;
}

export type CreateNotification = (input: CreateNotificationInput) => Promise<void>;

export interface CreateNotificationDeps {
  notificationRepository: NotificationRepository;
  clock: Clock;
}

/** Creates a notification unless the actor is the recipient — no self-notification (RF-009, D4 of research.md). */
export const makeCreateNotification =
  ({ notificationRepository, clock }: CreateNotificationDeps): CreateNotification =>
  async (input) => {
    if (input.recipientId === input.actorId) {
      return;
    }

    await notificationRepository.create(input, clock.now());
  };
