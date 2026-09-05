import type { Clock } from '../../container/cradle';
import type { ReactionRepository } from '../../repositories/reactions';
import type { ResolveVisibleActivity } from '../activities';
import type { CreateNotification } from '../notifications';

export interface CreateReactionInput {
  userId: string;
  activityId: string;
}

export type CreateReaction = (input: CreateReactionInput) => Promise<void>;

export interface CreateReactionDeps {
  reactionRepository: ReactionRepository;
  resolveVisibleActivity: ResolveVisibleActivity;
  createNotification: CreateNotification;
  clock: Clock;
}

/**
 * Reacts to a feed item; idempotent (RF-001, RF-002, RF-014). Notifies the item owner only when
 * this call actually inserted a new reaction — a repeated idempotent call never duplicates the
 * notification (008, D1 of research.md).
 */
export const makeCreateReaction =
  ({ reactionRepository, resolveVisibleActivity, createNotification, clock }: CreateReactionDeps): CreateReaction =>
  async ({ userId, activityId }) => {
    const activity = await resolveVisibleActivity(activityId, userId);
    const createdNow = await reactionRepository.add(
      activityId,
      userId,
      activity.readingSessionId,
      activity.type,
      clock.now(),
    );

    if (createdNow) {
      await createNotification({
        recipientId: activity.actorId,
        actorId: userId,
        type: 'reaction_on_content',
        activityId,
        readingSessionId: activity.readingSessionId,
        activityType: activity.type,
      });
    }
  };
