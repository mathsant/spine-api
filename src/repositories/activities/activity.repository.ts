import type { CursorPage } from '../shelf-memberships';

export type ActivityType = 'started_reading' | 'finished_reading' | 'review_published' | 'progress_update';

/** Persisted shape of an activity event, with the Mongo `_id` surfaced as `id`. */
export interface ActivityRecord {
  id: string;
  type: ActivityType;
  actorId: string;
  bookId: string;
  readingSessionId: string;
  currentPage: number | null;
  createdAt: Date;
}

export interface RecordActivityInput {
  type: ActivityType;
  actorId: string;
  bookId: string;
  readingSessionId: string;
  /** Only meaningful for `type === 'progress_update'` (006, D2 of research.md). */
  currentPage?: number;
}

/** Data-access port for the `activities` collection. */
export interface ActivityRepository {
  /** Inserts one event; `now` comes from the caller service's injected `Clock`. */
  record(input: RecordActivityInput, now: Date): Promise<ActivityRecord>;

  /** Cursor page ordered by `createdAt` desc, filtered by `actorId: { $in: actorIds }` (feed fan-out on read). */
  listForActors(actorIds: string[], cursor: string | null, limit: number): Promise<CursorPage<ActivityRecord>>;

  /** Removes every event of a session, any type — cascade of `delete-reading-session` (006, D4). */
  deleteBySessionId(readingSessionId: string): Promise<void>;

  /** Removes only the given type's event(s) of a session — cascade of `delete-review` (006, D4). */
  deleteBySessionIdAndType(readingSessionId: string, type: ActivityType): Promise<void>;
}
