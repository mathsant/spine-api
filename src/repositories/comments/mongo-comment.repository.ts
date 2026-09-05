import { type Db, ObjectId } from 'mongodb';

import type { ActivityType } from '../activities';
import { decodeCursor, encodeCursor } from '../../lib';
import type { CursorPage } from '../shelf-memberships';
import type { CommentRecord, CommentRepository, CreateCommentInput } from './comment.repository';

interface CommentDocument {
  _id: ObjectId;
  activityId: string;
  readingSessionId: string;
  activityType: ActivityType;
  authorId: string;
  text: string;
  parentCommentId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
}

function toRecord(doc: CommentDocument): CommentRecord {
  return {
    id: doc._id.toHexString(),
    activityId: doc.activityId,
    readingSessionId: doc.readingSessionId,
    activityType: doc.activityType,
    authorId: doc.authorId,
    text: doc.text,
    parentCommentId: doc.parentCommentId,
    deletedAt: doc.deletedAt,
    createdAt: doc.createdAt,
  };
}

export class MongoCommentRepository implements CommentRepository {
  private readonly comments;

  constructor(db: Db) {
    this.comments = db.collection<CommentDocument>('comments');
  }

  async create(input: CreateCommentInput, now: Date): Promise<CommentRecord> {
    const doc: CommentDocument = {
      _id: new ObjectId(),
      activityId: input.activityId,
      readingSessionId: input.readingSessionId,
      activityType: input.activityType,
      authorId: input.authorId,
      text: input.text,
      parentCommentId: input.parentCommentId ?? null,
      deletedAt: null,
      createdAt: now,
    };

    await this.comments.insertOne(doc);
    return toRecord(doc);
  }

  async findById(commentId: string): Promise<CommentRecord | null> {
    if (!ObjectId.isValid(commentId)) {
      return null;
    }
    const doc = await this.comments.findOne({ _id: new ObjectId(commentId) });
    return doc ? toRecord(doc) : null;
  }

  async listByActivity(
    activityId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<CommentRecord>> {
    const query: Record<string, unknown> = { activityId };
    if (cursor !== null) {
      const decoded = decodeCursor(cursor);
      const createdAt = new Date(decoded.createdAt);
      query.$or = [
        { createdAt: { $gt: createdAt } },
        { createdAt, _id: { $gt: new ObjectId(decoded.id) } },
      ];
    }

    const docs = await this.comments
      .find(query)
      .sort({ createdAt: 1, _id: 1 })
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

  async softDelete(commentId: string, deletedAt: Date): Promise<CommentRecord | null> {
    if (!ObjectId.isValid(commentId)) {
      return null;
    }
    const result = await this.comments.findOneAndUpdate(
      { _id: new ObjectId(commentId) },
      { $set: { deletedAt } },
      { returnDocument: 'after' },
    );
    return result ? toRecord(result) : null;
  }

  async deleteByReadingSessionId(readingSessionId: string): Promise<void> {
    await this.comments.deleteMany({ readingSessionId });
  }

  async deleteByReadingSessionIdAndType(readingSessionId: string, activityType: ActivityType): Promise<void> {
    await this.comments.deleteMany({ readingSessionId, activityType });
  }
}
