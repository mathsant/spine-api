import type { FollowRequestRepository } from '../../repositories/follow-requests';
import type { FollowRepository } from '../../repositories/follows';
import type { UserRepository } from '../../repositories/users';
import { compareSuggestionCandidates, type SuggestionCandidate } from './compare-suggestion-candidates';
import type { FollowSuggestionDTO, FollowSuggestionsResponseDTO } from './types';

/** At most this many suggestions (RF-002). */
const SUGGESTION_LIMIT = 4;

/**
 * Cold start over-fetches by this much so pending-request exclusions can be applied
 * after ranking without shortening the list. A brand-new user never has this many
 * outstanding requests aimed at the platform's most-followed accounts.
 */
const COLD_START_BUFFER = 20;

export interface GetFollowSuggestionsInput {
  viewerId: string;
}

export type GetFollowSuggestions = (
  input: GetFollowSuggestionsInput,
) => Promise<FollowSuggestionsResponseDTO>;

export interface GetFollowSuggestionsDeps {
  userRepository: UserRepository;
  followRepository: FollowRepository;
  followRequestRepository: FollowRequestRepository;
}

/**
 * Follow suggestions for the feed's right rail (012). Two mutually exclusive tracks
 * (research D1): friends-of-friends ranked by `mutualFollowersCount` when the viewer
 * already follows someone; global popularity (with `mutualFollowersCount` 0) as the
 * cold-start fallback. Excludes the viewer, everyone they approve-follow and every
 * pending outgoing follow-request. An empty list is a normal result (RF-011).
 */
export const makeGetFollowSuggestions =
  ({
    userRepository,
    followRepository,
    followRequestRepository,
  }: GetFollowSuggestionsDeps): GetFollowSuggestions =>
  async ({ viewerId }) => {
    const followeeIds = await followRepository.listFolloweeIds(viewerId);

    const ranked =
      followeeIds.length === 0
        ? await coldStart()
        : await fromNetwork(followeeIds);

    if (ranked.length === 0) {
      return { items: [] };
    }

    const followsYou = new Set(
      await followRepository.filterFollowers(
        viewerId,
        ranked.map((candidate) => candidate.userId),
      ),
    );

    const items: FollowSuggestionDTO[] = ranked.map((candidate) => ({
      id: candidate.userId,
      handle: candidate.handle,
      displayName: candidate.displayName,
      avatarUrl: null,
      followState: 'none',
      followsYou: followsYou.has(candidate.userId),
      mutualFollowersCount: candidate.mutualFollowersCount,
    }));

    return { items };

    async function fromNetwork(followees: string[]): Promise<SuggestionCandidate[]> {
      const raw = await followRepository.listFollowSuggestionCandidates(followees);

      const excluded = new Set<string>([viewerId, ...followees]);
      const visible = raw.filter((candidate) => !excluded.has(candidate.userId));
      if (visible.length === 0) {
        return [];
      }

      const pending = new Set(
        await followRequestRepository.filterPendingTargets(
          viewerId,
          visible.map((candidate) => candidate.userId),
        ),
      );
      const eligible = visible.filter((candidate) => !pending.has(candidate.userId));
      if (eligible.length === 0) {
        return [];
      }

      const eligibleIds = eligible.map((candidate) => candidate.userId);
      const [followerCounts, users] = await Promise.all([
        followRepository.countFollowersByUser(eligibleIds),
        userRepository.findByIds(eligibleIds),
      ]);
      const userById = new Map(users.map((user) => [user.id, user]));

      return eligible
        .flatMap((candidate) => {
          const user = userById.get(candidate.userId);
          return user
            ? [
                {
                  userId: candidate.userId,
                  mutualFollowersCount: candidate.mutualFollowersCount,
                  followerCount: followerCounts.get(candidate.userId) ?? 0,
                  handle: user.handle,
                  displayName: user.displayName,
                  createdAt: user.createdAt,
                },
              ]
            : [];
        })
        .sort(compareSuggestionCandidates)
        .slice(0, SUGGESTION_LIMIT);
    }

    async function coldStart(): Promise<SuggestionCandidate[]> {
      const rankedIds = await followRepository.listMostFollowedUsers(
        SUGGESTION_LIMIT + COLD_START_BUFFER,
        [viewerId],
      );
      if (rankedIds.length === 0) {
        return [];
      }

      const pending = new Set(
        await followRequestRepository.filterPendingTargets(viewerId, rankedIds),
      );
      const eligibleIds = rankedIds
        .filter((id) => !pending.has(id))
        .slice(0, SUGGESTION_LIMIT);
      if (eligibleIds.length === 0) {
        return [];
      }

      const users = await userRepository.findByIds(eligibleIds);
      const userById = new Map(users.map((user) => [user.id, user]));

      // Preserve the popularity ranking the repository already applied.
      return eligibleIds.flatMap((id) => {
        const user = userById.get(id);
        return user
          ? [
              {
                userId: id,
                mutualFollowersCount: 0,
                followerCount: 0,
                handle: user.handle,
                displayName: user.displayName,
                createdAt: user.createdAt,
              },
            ]
          : [];
      });
    }
  };
