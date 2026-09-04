import { type Db, MongoServerError, ObjectId } from 'mongodb';

import { InvalidReadingSessionDatesError, InvalidReadingSessionStateError, ReadingSessionNotFoundError } from '../../errors';
import { decodeCursor, encodeCursor } from '../../lib';
import type { CursorPage } from '../shelf-memberships';
import type {
  EditReadingSessionInput,
  ReadingSessionRecord,
  ReadingSessionRepository,
} from './reading-session.repository';

const DUPLICATE_KEY = 11000;

interface ReadingSessionDocument {
  _id: ObjectId;
  userId: string;
  bookId: string;
  status: 'reading' | 'finished';
  startedAt: Date | null;
  finishedAt: Date | null;
  currentPage: number | null;
  createdAt: Date;
  updatedAt: Date;
}

function toRecord(doc: ReadingSessionDocument): ReadingSessionRecord {
  return {
    id: doc._id.toHexString(),
    userId: doc.userId,
    bookId: doc.bookId,
    status: doc.status,
    startedAt: doc.startedAt,
    finishedAt: doc.finishedAt,
    currentPage: doc.currentPage,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoReadingSessionRepository implements ReadingSessionRepository {
  private readonly sessions;

  constructor(db: Db) {
    this.sessions = db.collection<ReadingSessionDocument>('reading_sessions');
  }

  async startReading(userId: string, bookId: string, startedAt: Date): Promise<ReadingSessionRecord> {
    const now = new Date();
    const doc: ReadingSessionDocument = {
      _id: new ObjectId(),
      userId,
      bookId,
      status: 'reading',
      startedAt,
      finishedAt: null,
      currentPage: null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.sessions.insertOne(doc);
      return toRecord(doc);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
        const existing = await this.sessions.findOne({ userId, bookId, status: 'reading' });
        if (existing) {
          return toRecord(existing);
        }
      }
      throw error;
    }
  }

  async createFinished(
    userId: string,
    bookId: string,
    input: { startedAt: Date | null; finishedAt: Date },
  ): Promise<ReadingSessionRecord> {
    const now = new Date();
    const doc: ReadingSessionDocument = {
      _id: new ObjectId(),
      userId,
      bookId,
      status: 'finished',
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      currentPage: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.sessions.insertOne(doc);
    return toRecord(doc);
  }

  async findById(sessionId: string): Promise<ReadingSessionRecord | null> {
    if (!ObjectId.isValid(sessionId)) {
      return null;
    }
    const doc = await this.sessions.findOne({ _id: new ObjectId(sessionId) });
    return doc ? toRecord(doc) : null;
  }

  async findOpenSession(userId: string, bookId: string): Promise<ReadingSessionRecord | null> {
    const doc = await this.sessions.findOne({ userId, bookId, status: 'reading' });
    return doc ? toRecord(doc) : null;
  }

  async updateProgress(sessionId: string, currentPage: number): Promise<ReadingSessionRecord> {
    const doc = await this.requireDoc(sessionId);
    if (doc.status !== 'reading') {
      throw new InvalidReadingSessionStateError();
    }

    const updatedAt = new Date();
    await this.sessions.updateOne({ _id: doc._id }, { $set: { currentPage, updatedAt } });
    return toRecord({ ...doc, currentPage, updatedAt });
  }

  async finish(sessionId: string, finishedAt: Date): Promise<ReadingSessionRecord> {
    const doc = await this.requireDoc(sessionId);
    const updatedAt = new Date();

    await this.sessions.updateOne(
      { _id: doc._id },
      { $set: { status: 'finished', finishedAt, updatedAt } },
    );
    return toRecord({ ...doc, status: 'finished', finishedAt, updatedAt });
  }

  async edit(sessionId: string, patch: EditReadingSessionInput): Promise<ReadingSessionRecord> {
    const doc = await this.requireDoc(sessionId);

    const startedAt = patch.startedAt ?? doc.startedAt;
    const finishedAt = patch.finishedAt ?? doc.finishedAt;
    if (startedAt !== null && finishedAt !== null && finishedAt.getTime() < startedAt.getTime()) {
      throw new InvalidReadingSessionDatesError();
    }

    const updatedAt = new Date();
    const update: Partial<ReadingSessionDocument> = { updatedAt };
    if (patch.startedAt !== undefined) update.startedAt = patch.startedAt;
    if (patch.finishedAt !== undefined) update.finishedAt = patch.finishedAt;
    if (patch.currentPage !== undefined) update.currentPage = patch.currentPage;

    await this.sessions.updateOne({ _id: doc._id }, { $set: update });
    return toRecord({ ...doc, ...update });
  }

  async delete(sessionId: string): Promise<void> {
    if (!ObjectId.isValid(sessionId)) {
      return;
    }
    await this.sessions.deleteOne({ _id: new ObjectId(sessionId) });
  }

  async listByUser(
    userId: string,
    filter: { bookId?: string },
    cursor: string | null,
    limit: number,
  ): Promise<CursorPage<ReadingSessionRecord>> {
    const query: Record<string, unknown> = { userId };
    if (filter.bookId !== undefined) {
      query.bookId = filter.bookId;
    }
    if (cursor !== null) {
      const decoded = decodeCursor(cursor);
      const createdAt = new Date(decoded.createdAt);
      query.$or = [
        { createdAt: { $lt: createdAt } },
        { createdAt, _id: { $lt: new ObjectId(decoded.id) } },
      ];
    }

    const docs = await this.sessions
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

  async countDistinctFinishedReaders(bookId: string): Promise<number> {
    const readers = await this.sessions.distinct('userId', { bookId, status: 'finished' });
    return readers.length;
  }

  private async requireDoc(sessionId: string): Promise<ReadingSessionDocument> {
    if (!ObjectId.isValid(sessionId)) {
      throw new ReadingSessionNotFoundError();
    }
    const doc = await this.sessions.findOne({ _id: new ObjectId(sessionId) });
    if (!doc) {
      throw new ReadingSessionNotFoundError();
    }
    return doc;
  }
}
