import { type Db, MongoServerError, ObjectId } from 'mongodb';

import { decodeCursor, encodeCursor } from '../../lib';
import type { CursorPage } from '../shelf-memberships';
import type { FollowRequestRecord, FollowRequestRepository } from './follow-request.repository';

const DUPLICATE_KEY = 11000;

interface FollowRequestDocument {
  _id: ObjectId;
  requesterId: string;
  targetId: string;
  createdAt: Date;
}

function toRecord(doc: FollowRequestDocument): FollowRequestRecord {
  return {
    id: doc._id.toHexString(),
    requesterId: doc.requesterId,
    targetId: doc.targetId,
    createdAt: doc.createdAt,
  };
}

export class MongoFollowRequestRepository implements FollowRequestRepository {
  private readonly requests;

  constructor(db: Db) {
    this.requests = db.collection<FollowRequestDocument>('follow_requests');
  }

  async create(requesterId: string, targetId: string, now: Date): Promise<FollowRequestRecord> {
    const doc: FollowRequestDocument = {
      _id: new ObjectId(),
      requesterId,
      targetId,
      createdAt: now,
    };

    try {
      await this.requests.insertOne(doc);
      return toRecord(doc);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
        const existing = await this.requests.findOne({ requesterId, targetId });
        if (existing) {
          return toRecord(existing);
        }
      }
      throw error;
    }
  }

  async findByPair(requesterId: string, targetId: string): Promise<FollowRequestRecord | null> {
    const doc = await this.requests.findOne({ requesterId, targetId });
    return doc ? toRecord(doc) : null;
  }

  async deleteByPair(requesterId: string, targetId: string): Promise<FollowRequestRecord | null> {
    const doc = await this.requests.findOneAndDelete({ requesterId, targetId });
    return doc ? toRecord(doc) : null;
  }

  async listByTarget(
    targetId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<FollowRequestRecord>> {
    return this.listByField('targetId', targetId, cursor, limit);
  }

  async listByRequester(
    requesterId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<FollowRequestRecord>> {
    return this.listByField('requesterId', requesterId, cursor, limit);
  }

  private async listByField(
    field: 'targetId' | 'requesterId',
    value: string,
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<FollowRequestRecord>> {
    const query: Record<string, unknown> = { [field]: value };
    if (cursor !== null) {
      const decoded = decodeCursor(cursor);
      const createdAt = new Date(decoded.createdAt);
      query.$or = [
        { createdAt: { $lt: createdAt } },
        { createdAt, _id: { $lt: new ObjectId(decoded.id) } },
      ];
    }

    const docs = await this.requests
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
}
