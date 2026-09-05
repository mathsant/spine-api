import { ActivityNotFoundError, UnsupportedActivityInteractionError } from '../../errors';
import type { ActivityRecord, ActivityRepository } from '../../repositories/activities';
import type { FollowRepository } from '../../repositories/follows';

export type ResolveVisibleActivity = (activityId: string, viewerId: string) => Promise<ActivityRecord>;

export interface ResolveVisibleActivityDeps {
  activityRepository: ActivityRepository;
  followRepository: FollowRepository;
}

/**
 * Resolves the target of a comment/reaction: it must exist, the viewer must be its owner or an
 * approved follower of the owner (P6), and its type must support interactions (RF-011). Shared
 * by `create-comment`, `list-comments`, `create-reaction` and `delete-reaction` (007, D1).
 */
export const makeResolveVisibleActivity =
  ({ activityRepository, followRepository }: ResolveVisibleActivityDeps): ResolveVisibleActivity =>
  async (activityId, viewerId) => {
    const activity = await activityRepository.findById(activityId);
    if (!activity) {
      throw new ActivityNotFoundError();
    }

    if (activity.actorId !== viewerId && !(await followRepository.exists(viewerId, activity.actorId))) {
      throw new ActivityNotFoundError();
    }

    if (activity.type === 'started_reading') {
      throw new UnsupportedActivityInteractionError();
    }

    return activity;
  };
