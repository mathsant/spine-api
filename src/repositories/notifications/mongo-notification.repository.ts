import { type Db, ObjectId } from 'mongodb';

import type { ActivityType } from '../activities';
import { decodeCursor, encodeCursor } from '../../lib';
import type { CursorPage } from '../shelf-memberships';
import type {
  CreateNotificationRecordInput,
  NotificationRecord,
  NotificationRepository,
  NotificationType,
} from './notification.repository';

interface NotificationDocument {
  _id: ObjectId;
  recipientId: string;
  type: NotificationType;
  actorId: string;
  activityId: string | null;
  commentId: string | null;
  readingSessionId: string | null;
  activityType: ActivityType | null;
  readAt: Date | null;
  createdAt: Date;
}

function toRecord(doc: NotificationDocument): NotificationRecord {
  return {
    id: doc._id.toHexString(),
    recipientId: doc.recipientId,
    type: doc.type,
    actorId: doc.actorId,
    activityId: doc.activityId,
    commentId: doc.commentId,
    readingSessionId: doc.readingSessionId,
    activityType: doc.activityType,
    readAt: doc.readAt,
    createdAt: doc.createdAt,
  };
}

export class MongoNotificationRepository implements NotificationRepository {
  private readonly notifications;

  constructor(db: Db) {
    this.notifications = db.collection<NotificationDocument>('notifications');
  }

  async create(input: CreateNotificationRecordInput, now: Date): Promise<NotificationRecord> {
    const doc: NotificationDocument = {
      _id: new ObjectId(),
      recipientId: input.recipientId,
      type: input.type,
      actorId: input.actorId,
      activityId: input.activityId ?? null,
      commentId: input.commentId ?? null,
      readingSessionId: input.readingSessionId ?? null,
      activityType: input.activityType ?? null,
      readAt: null,
      createdAt: now,
    };

    await this.notifications.insertOne(doc);
    return toRecord(doc);
  }

  async findById(notificationId: string): Promise<NotificationRecord | null> {
    if (!ObjectId.isValid(notificationId)) {
      return null;
    }
    const doc = await this.notifications.findOne({ _id: new ObjectId(notificationId) });
    return doc ? toRecord(doc) : null;
  }

  async listByRecipient(
    recipientId: string,
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<NotificationRecord>> {
    const query: Record<string, unknown> = { recipientId };
    if (cursor !== null) {
      const decoded = decodeCursor(cursor);
      const createdAt = new Date(decoded.createdAt);
      query.$or = [
        { createdAt: { $lt: createdAt } },
        { createdAt, _id: { $lt: new ObjectId(decoded.id) } },
      ];
    }

    const docs = await this.notifications
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

  async markRead(notificationId: string, readAt: Date): Promise<void> {
    if (!ObjectId.isValid(notificationId)) {
      return;
    }
    await this.notifications.updateOne({ _id: new ObjectId(notificationId) }, { $set: { readAt } });
  }

  async markAllRead(recipientId: string, readAt: Date): Promise<number> {
    const result = await this.notifications.updateMany({ recipientId, readAt: null }, { $set: { readAt } });
    return result.modifiedCount;
  }

  async countUnread(recipientId: string): Promise<number> {
    return this.notifications.countDocuments({ recipientId, readAt: null });
  }

  async deleteFollowRequestNotification(recipientId: string, actorId: string): Promise<void> {
    await this.notifications.deleteMany({ recipientId, actorId, type: 'follow_request' });
  }

  async deleteReactionNotification(activityId: string, actorId: string): Promise<void> {
    await this.notifications.deleteMany({ activityId, actorId, type: 'reaction_on_content' });
  }

  async deleteByCommentId(commentId: string): Promise<void> {
    await this.notifications.deleteMany({ commentId });
  }

  async deleteByReadingSessionId(readingSessionId: string): Promise<void> {
    await this.notifications.deleteMany({ readingSessionId });
  }

  async deleteByReadingSessionIdAndType(readingSessionId: string, activityType: ActivityType): Promise<void> {
    await this.notifications.deleteMany({ readingSessionId, activityType });
  }
}
