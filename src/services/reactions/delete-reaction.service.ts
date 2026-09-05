import { ReactionNotFoundError } from '../../errors';
import type { NotificationRepository } from '../../repositories/notifications';
import type { ReactionRepository } from '../../repositories/reactions';
import type { ResolveVisibleActivity } from '../activities';

export interface DeleteReactionInput {
  userId: string;
  activityId: string;
}

export type DeleteReaction = (input: DeleteReactionInput) => Promise<void>;

export interface DeleteReactionDeps {
  reactionRepository: ReactionRepository;
  resolveVisibleActivity: ResolveVisibleActivity;
  notificationRepository: NotificationRepository;
}

/** Removes a reaction from a feed item (RF-003); removes the notification it originated (008, RF-010). */
export const makeDeleteReaction =
  ({ reactionRepository, resolveVisibleActivity, notificationRepository }: DeleteReactionDeps): DeleteReaction =>
  async ({ userId, activityId }) => {
    await resolveVisibleActivity(activityId, userId);
    const removed = await reactionRepository.remove(activityId, userId);
    if (!removed) {
      throw new ReactionNotFoundError();
    }

    await notificationRepository.deleteReactionNotification(activityId, userId);
  };
