import { type Db, ObjectId } from 'mongodb';

import { decodeCursor, encodeCursor } from '../../lib';
import type {
  CursorPage,
  ShelfMembershipRecord,
  ShelfMembershipRepository,
} from './shelf-membership.repository';

interface ShelfMembershipDocument {
  _id: ObjectId;
  userId: string;
  bookId: string;
  createdAt: Date;
}

function toRecord(doc: ShelfMembershipDocument): ShelfMembershipRecord {
  return { id: doc._id.toHexString(), userId: doc.userId, bookId: doc.bookId, createdAt: doc.createdAt };
}

export class MongoShelfMembershipRepository implements ShelfMembershipRepository {
  private readonly memberships;

  constructor(db: Db) {
    this.memberships = db.collection<ShelfMembershipDocument>('shelf_memberships');
  }

  async add(userId: string, bookId: string): Promise<void> {
    await this.memberships.updateOne(
      { userId, bookId },
      { $setOnInsert: { _id: new ObjectId(), userId, bookId, createdAt: new Date() } },
      { upsert: true },
    );
  }

  async remove(userId: string, bookId: string): Promise<void> {
    await this.memberships.deleteOne({ userId, bookId });
  }

  async listBookIdsForUser(userId: string): Promise<string[]> {
    return this.memberships.distinct('bookId', { userId });
  }

  async list(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<ShelfMembershipRecord>> {
    const filter: Record<string, unknown> = { userId };

    if (cursor !== null) {
      const decoded = decodeCursor(cursor);
      const createdAt = new Date(decoded.createdAt);
      filter.$or = [
        { createdAt: { $lt: createdAt } },
        { createdAt, _id: { $lt: new ObjectId(decoded.id) } },
      ];
    }

    const docs = await this.memberships
      .find(filter)
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
