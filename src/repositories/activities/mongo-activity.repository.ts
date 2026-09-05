import { type Db, ObjectId } from 'mongodb';

import { decodeCursor, encodeCursor } from '../../lib';
import type { CursorPage } from '../shelf-memberships';
import type {
  ActivityRecord,
  ActivityRepository,
  ActivityType,
  RecordActivityInput,
} from './activity.repository';

interface ActivityDocument {
  _id: ObjectId;
  type: ActivityType;
  actorId: string;
  bookId: string;
  readingSessionId: string;
  currentPage: number | null;
  createdAt: Date;
}

function toRecord(doc: ActivityDocument): ActivityRecord {
  return {
    id: doc._id.toHexString(),
    type: doc.type,
    actorId: doc.actorId,
    bookId: doc.bookId,
    readingSessionId: doc.readingSessionId,
    currentPage: doc.currentPage,
    createdAt: doc.createdAt,
  };
}

export class MongoActivityRepository implements ActivityRepository {
  private readonly activities;

  constructor(db: Db) {
    this.activities = db.collection<ActivityDocument>('activities');
  }

  async record(input: RecordActivityInput, now: Date): Promise<ActivityRecord> {
    const doc: ActivityDocument = {
      _id: new ObjectId(),
      type: input.type,
      actorId: input.actorId,
      bookId: input.bookId,
      readingSessionId: input.readingSessionId,
      currentPage: input.currentPage ?? null,
      createdAt: now,
    };

    await this.activities.insertOne(doc);
    return toRecord(doc);
  }

  async findById(activityId: string): Promise<ActivityRecord | null> {
    if (!ObjectId.isValid(activityId)) {
      return null;
    }
    const doc = await this.activities.findOne({ _id: new ObjectId(activityId) });
    return doc ? toRecord(doc) : null;
  }

  async listForActors(
    actorIds: string[],
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<ActivityRecord>> {
    const query: Record<string, unknown> = { actorId: { $in: actorIds } };
    if (cursor !== null) {
      const decoded = decodeCursor(cursor);
      const createdAt = new Date(decoded.createdAt);
      query.$or = [
        { createdAt: { $lt: createdAt } },
        { createdAt, _id: { $lt: new ObjectId(decoded.id) } },
      ];
    }

    const docs = await this.activities
      .find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;
    const last = page.at(-1);

    return {
      items: page.map(toRecord),
      nextCursor:
        hasMore && last
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last._id.toHexString() })
          : null,
    };
  }

  async deleteBySessionId(readingSessionId: string): Promise<void> {
    await this.activities.deleteMany({ readingSessionId });
  }

  async deleteBySessionIdAndType(readingSessionId: string, type: ActivityType): Promise<void> {
    await this.activities.deleteMany({ readingSessionId, type });
  }
}
