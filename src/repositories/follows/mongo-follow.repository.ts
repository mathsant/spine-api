import { type Db, ObjectId } from 'mongodb';

import { decodeCursor, encodeCursor } from '../../lib';
import type { CursorPage } from '../shelf-memberships';
import type { FollowRecord, FollowRepository } from './follow.repository';

interface FollowDocument {
  _id: ObjectId;
  followerId: string;
  followeeId: string;
  createdAt: Date;
}

function toRecord(doc: FollowDocument): FollowRecord {
  return {
    id: doc._id.toHexString(),
    followerId: doc.followerId,
    followeeId: doc.followeeId,
    createdAt: doc.createdAt,
  };
}

export class MongoFollowRepository implements FollowRepository {
  private readonly follows;

  constructor(db: Db) {
    this.follows = db.collection<FollowDocument>('follows');
  }

  async create(followerId: string, followeeId: string, now: Date): Promise<FollowRecord> {
    const doc: FollowDocument = {
      _id: new ObjectId(),
      followerId,
      followeeId,
      createdAt: now,
    };
    await this.follows.insertOne(doc);
    return toRecord(doc);
  }

  async exists(followerId: string, followeeId: string): Promise<boolean> {
    const doc = await this.follows.findOne({ followerId, followeeId }, { projection: { _id: 1 } });
    return doc !== null;
  }

  async deleteByPair(followerId: string, followeeId: string): Promise<FollowRecord | null> {
    const doc = await this.follows.findOneAndDelete({ followerId, followeeId });
    return doc ? toRecord(doc) : null;
  }

  async listByFollowee(
    followeeId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<FollowRecord>> {
    return this.listByField('followeeId', followeeId, cursor, limit);
  }

  async listByFollower(
    followerId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<FollowRecord>> {
    return this.listByField('followerId', followerId, cursor, limit);
  }

  async listFolloweeIds(followerId: string): Promise<string[]> {
    return this.follows.distinct('followeeId', { followerId });
  }

  private async listByField(
    field: 'followeeId' | 'followerId',
    value: string,
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<FollowRecord>> {
    const query: Record<string, unknown> = { [field]: value };
    if (cursor !== null) {
      const decoded = decodeCursor(cursor);
      const createdAt = new Date(decoded.createdAt);
      query.$or = [
        { createdAt: { $lt: createdAt } },
        { createdAt, _id: { $lt: new ObjectId(decoded.id) } },
      ];
    }

    const docs = await this.follows
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
