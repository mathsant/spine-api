/** A follow-suggestion candidate before ranking and truncation. */
export interface SuggestionCandidate {
  userId: string;
  /** People the viewer approved-follows who also follow this candidate (0 on the popularity track). */
  mutualFollowersCount: number;
  /** Total approved followers of the candidate — the first tie-breaker. */
  followerCount: number;
  handle: string;
  displayName: string;
  createdAt: Date;
}

/**
 * Total order for follow suggestions (RF-006): `mutualFollowersCount` desc, then
 * `followerCount` desc, then `createdAt` desc (most recent first), then `userId` desc so
 * the result is stable for the same state regardless of input order.
 */
export function compareSuggestionCandidates(a: SuggestionCandidate, b: SuggestionCandidate): number {
  if (a.mutualFollowersCount !== b.mutualFollowersCount) {
    return b.mutualFollowersCount - a.mutualFollowersCount;
  }
  if (a.followerCount !== b.followerCount) {
    return b.followerCount - a.followerCount;
  }
  const aTime = a.createdAt.getTime();
  const bTime = b.createdAt.getTime();
  if (aTime !== bTime) {
    return bTime - aTime;
  }
  return b.userId.localeCompare(a.userId);
}
