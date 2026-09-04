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
}
