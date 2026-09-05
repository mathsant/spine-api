import type { ActivityType } from '../activities';

/** Persisted shape of a reaction (single "like" type) on a feed item. */
export interface ReactionRecord {
  id: string;
  activityId: string;
  readingSessionId: string;
  activityType: ActivityType;
  userId: string;
  createdAt: Date;
}

/** Data-access port for the `reactions` collection. */
export interface ReactionRepository {
  /**
   * Idempotent upsert keyed by `{ activityId, userId }` — repeating never duplicates (RF-002, D4).
   * Returns `true` when this call actually inserted a new reaction, `false` when one already
   * existed (008, D1 of research.md) — used by `create-reaction.service.ts` to only notify on a
   * genuinely new reaction.
   */
  add(
    activityId: string,
    userId: string,
    readingSessionId: string,
    activityType: ActivityType,
    now: Date,
  ): Promise<boolean>;

  /** `true` if a reaction was actually removed (RF-003 — `ReactionNotFoundError` when `false`). */
  remove(activityId: string, userId: string): Promise<boolean>;

  /** Reaction count per activity, batched (used by the feed, D7 of research.md). */
  countByActivityIds(activityIds: string[]): Promise<Map<string, number>>;

  /** Which of `activityIds` the given user already reacted to (used by the feed, D7). */
  listReactedActivityIds(userId: string, activityIds: string[]): Promise<string[]>;

  /** Removes every reaction of a session, any `activityType` — cascade of `delete-reading-session` (RF-013). */
  deleteByReadingSessionId(readingSessionId: string): Promise<void>;

  /** Removes only the given type's reactions of a session — cascade of `delete-review` (RF-013). */
  deleteByReadingSessionIdAndType(readingSessionId: string, activityType: ActivityType): Promise<void>;
}
