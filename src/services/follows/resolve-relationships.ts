import type { FollowRequestRepository } from '../../repositories/follow-requests';
import type { FollowRepository } from '../../repositories/follows';

export type FollowState = 'none' | 'pending' | 'following';

export interface Relationship {
  /** Viewer -> candidate: `following` (approved), `pending` (request sent), else `none`. */
  followState: FollowState;
  /** Candidate -> viewer: approved follow only (a pending request does not count). */
  followsYou: boolean;
}

export interface ResolveRelationshipsDeps {
  followRepository: FollowRepository;
  followRequestRepository: FollowRequestRepository;
}

/**
 * Resolves, for a whole page of `candidateIds` at once, the relationship of each with
 * `viewerId` (011 — D4/D5). Three batched `$in` queries, no per-item query. `following`
 * wins over `pending` (RF-003). The viewer's own id resolves to `none` / `false`.
 */
export async function resolveRelationships(
  viewerId: string,
  candidateIds: string[],
  { followRepository, followRequestRepository }: ResolveRelationshipsDeps,
): Promise<Map<string, Relationship>> {
  const ids = [...new Set(candidateIds)];
  if (ids.length === 0) {
    return new Map();
  }

  const [following, pending, followers] = await Promise.all([
    followRepository.filterFollowing(viewerId, ids),
    followRequestRepository.filterPendingTargets(viewerId, ids),
    followRepository.filterFollowers(viewerId, ids),
  ]);

  const followingSet = new Set(following);
  const pendingSet = new Set(pending);
  const followersSet = new Set(followers);

  const result = new Map<string, Relationship>();
  for (const id of ids) {
    const followState: FollowState = followingSet.has(id)
      ? 'following'
      : pendingSet.has(id)
        ? 'pending'
        : 'none';
    result.set(id, { followState, followsYou: followersSet.has(id) });
  }
  return result;
}
