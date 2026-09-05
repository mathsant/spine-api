import type { Clock } from '../../container/cradle';
import type { ReactionRepository } from '../../repositories/reactions';
import type { ResolveVisibleActivity } from '../activities';

export interface CreateReactionInput {
  userId: string;
  activityId: string;
}

export type CreateReaction = (input: CreateReactionInput) => Promise<void>;

export interface CreateReactionDeps {
  reactionRepository: ReactionRepository;
  resolveVisibleActivity: ResolveVisibleActivity;
  clock: Clock;
}

/** Reacts to a feed item; idempotent (RF-001, RF-002, RF-014). */
export const makeCreateReaction =
  ({ reactionRepository, resolveVisibleActivity, clock }: CreateReactionDeps): CreateReaction =>
  async ({ userId, activityId }) => {
    const activity = await resolveVisibleActivity(activityId, userId);
    await reactionRepository.add(activityId, userId, activity.readingSessionId, activity.type, clock.now());
  };
