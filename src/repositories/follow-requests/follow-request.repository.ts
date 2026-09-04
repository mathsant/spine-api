import type { CursorPage } from '../shelf-memberships';

/** Persisted shape of a pending follow request, with the Mongo `_id` surfaced as `id`. */
export interface FollowRequestRecord {
  id: string;
  requesterId: string;
  targetId: string;
  createdAt: Date;
}

/** Data-access port for the `follow_requests` collection (only pending requests live here). */
export interface FollowRequestRepository {
  /**
   * Inserts a pending request. On a unique-index violation (requesterId+targetId) returns
   * the already-existing request instead of throwing (RF-008).
   */
  create(requesterId: string, targetId: string, now: Date): Promise<FollowRequestRecord>;

  findByPair(requesterId: string, targetId: string): Promise<FollowRequestRecord | null>;

  /** Deletes the request for this pair; returns the deleted record, `null` if none existed. */
  deleteByPair(requesterId: string, targetId: string): Promise<FollowRequestRecord | null>;

  /** Cursor page ordered by `createdAt` desc — requests received by `targetId`. */
  listByTarget(
    targetId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<FollowRequestRecord>>;

  /** Cursor page ordered by `createdAt` desc — requests sent by `requesterId`. */
  listByRequester(
    requesterId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<FollowRequestRecord>>;
}
