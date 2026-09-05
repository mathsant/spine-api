import { type Db, ObjectId } from 'mongodb';

import type { ActivityType } from '../activities';
import type { ReactionRepository } from './reaction.repository';

interface ReactionDocument {
  _id: ObjectId;
  activityId: string;
  readingSessionId: string;
  activityType: ActivityType;
  userId: string;
  createdAt: Date;
}

export class MongoReactionRepository implements ReactionRepository {
  private readonly reactions;

  constructor(db: Db) {
    this.reactions = db.collection<ReactionDocument>('reactions');
  }

  async add(
    activityId: string,
    userId: string,
    readingSessionId: string,
    activityType: ActivityType,
    now: Date,
  ): Promise<void> {
    await this.reactions.updateOne(
      { activityId, userId },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          activityId,
          userId,
          readingSessionId,
          activityType,
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }

  async remove(activityId: string, userId: string): Promise<boolean> {
    const result = await this.reactions.deleteOne({ activityId, userId });
    return result.deletedCount > 0;
  }

  async countByActivityIds(activityIds: string[]): Promise<Map<string, number>> {
    if (activityIds.length === 0) {
      return new Map();
    }

    const rows = await this.reactions
      .aggregate<{ _id: string; count: number }>([
        { $match: { activityId: { $in: activityIds } } },
        { $group: { _id: '$activityId', count: { $sum: 1 } } },
      ])
      .toArray();

    return new Map(rows.map((row) => [row._id, row.count]));
  }

  async listReactedActivityIds(userId: string, activityIds: string[]): Promise<string[]> {
    if (activityIds.length === 0) {
      return [];
    }

    const docs = await this.reactions
      .find({ userId, activityId: { $in: activityIds } }, { projection: { activityId: 1 } })
      .toArray();

    return docs.map((doc) => doc.activityId);
  }

  async deleteByReadingSessionId(readingSessionId: string): Promise<void> {
    await this.reactions.deleteMany({ readingSessionId });
  }

  async deleteByReadingSessionIdAndType(readingSessionId: string, activityType: ActivityType): Promise<void> {
    await this.reactions.deleteMany({ readingSessionId, activityType });
  }
}

