import type { CursorPage } from '../shelf-memberships';

/** Persisted shape of an approved follow relation, with the Mongo `_id` surfaced as `id`. */
export interface FollowRecord {
  id: string;
  followerId: string;
  followeeId: string;
  createdAt: Date;
}

/** Data-access port for the `follows` collection. */
export interface FollowRepository {
  /** Called only by the approval flow (RF-010). */
  create(followerId: string, followeeId: string, now: Date): Promise<FollowRecord>;

  exists(followerId: string, followeeId: string): Promise<boolean>;

  /** Deletes the relation for this pair; returns the deleted record, `null` if none existed. */
  deleteByPair(followerId: string, followeeId: string): Promise<FollowRecord | null>;

  /** Cursor page ordered by `createdAt` desc — followers of `followeeId` (RF-018). */
  listByFollowee(
    followeeId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<FollowRecord>>;

  /** Cursor page ordered by `createdAt` desc — who `followerId` follows (RF-019). */
  listByFollower(
    followerId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<FollowRecord>>;

  /** Full, unpaginated list of who `followerId` follows — internal use by the feed's `$in` filter (006, D6). */
  listFolloweeIds(followerId: string): Promise<string[]>;

  /**
   * Subset of `candidateIds` that `followerId` approved-follows. Empty `candidateIds`
   * returns `[]` without touching the database. Batch resolution of `followState` (011).
   */
  filterFollowing(followerId: string, candidateIds: string[]): Promise<string[]>;

  /**
   * Subset of `candidateIds` that approved-follow `followeeId`. Empty `candidateIds`
   * returns `[]` without touching the database. Batch resolution of `followsYou` (011).
   */
  filterFollowers(followeeId: string, candidateIds: string[]): Promise<string[]>;

  /** Count of approved follows where `userId` is the followee (011, GET /me/stats). */
  countFollowers(userId: string): Promise<number>;

  /** Count of approved follows where `userId` is the follower (011, GET /me/stats). */
  countFollowing(userId: string): Promise<number>;

  /**
   * Friends-of-friends for follow suggestions (012): for every user followed by someone
   * in `followeeIds`, how many of those `followeeIds` follow them. Empty `followeeIds`
   * returns `[]` without touching the database. Index-only via the forward unique index.
   */
  listFollowSuggestionCandidates(
    followeeIds: string[],
  ): Promise<{ userId: string; mutualFollowersCount: number }[]>;

  /**
   * Approved-follower count per user in `userIds` (012, tie-breaker for suggestions).
   * Users with zero followers are absent from the map. Empty input → empty map.
   */
  countFollowersByUser(userIds: string[]): Promise<Map<string, number>>;

  /**
   * Cold-start suggestions (012): user ids ordered by approved-follower count desc
   * (then `_id` desc), capped at `limit`, excluding `excludeUserIds`. Index-only.
   */
  listMostFollowedUsers(limit: number, excludeUserIds: string[]): Promise<string[]>;
}
