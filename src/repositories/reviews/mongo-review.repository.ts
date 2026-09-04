import { type Db, MongoServerError, ObjectId } from 'mongodb';

import { ReviewAlreadyExistsError, ReviewNotFoundError } from '../../errors';
import type {
  CreateReviewInput,
  EditReviewInput,
  ReviewAggregates,
  ReviewRecord,
  ReviewRepository,
} from './review.repository';

const DUPLICATE_KEY = 11000;

interface ReviewDocument {
  _id: ObjectId;
  userId: string;
  sessionId: string;
  bookId: string;
  rating: number;
  text: string | null;
  containsSpoiler: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toRecord(doc: ReviewDocument): ReviewRecord {
  return {
    id: doc._id.toHexString(),
    userId: doc.userId,
    sessionId: doc.sessionId,
    bookId: doc.bookId,
    rating: doc.rating,
    text: doc.text,
    containsSpoiler: doc.containsSpoiler,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export class MongoReviewRepository implements ReviewRepository {
  private readonly reviews;

  constructor(db: Db) {
    this.reviews = db.collection<ReviewDocument>('reviews');
  }

  async create(
    userId: string,
    sessionId: string,
    bookId: string,
    input: CreateReviewInput,
  ): Promise<ReviewRecord> {
    const now = new Date();
    const doc: ReviewDocument = {
      _id: new ObjectId(),
      userId,
      sessionId,
      bookId,
      rating: input.rating,
      text: input.text ?? null,
      containsSpoiler: input.containsSpoiler ?? false,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.reviews.insertOne(doc);
      return toRecord(doc);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
        throw new ReviewAlreadyExistsError();
      }
      throw error;
    }
  }

  async findById(reviewId: string): Promise<ReviewRecord | null> {
    if (!ObjectId.isValid(reviewId)) {
      return null;
    }
    const doc = await this.reviews.findOne({ _id: new ObjectId(reviewId) });
    return doc ? toRecord(doc) : null;
  }

  async findBySessionId(sessionId: string): Promise<ReviewRecord | null> {
    const doc = await this.reviews.findOne({ sessionId });
    return doc ? toRecord(doc) : null;
  }

  async findBySessionIds(sessionIds: string[]): Promise<ReviewRecord[]> {
    if (sessionIds.length === 0) {
      return [];
    }
    const docs = await this.reviews.find({ sessionId: { $in: sessionIds } }).toArray();
    return docs.map(toRecord);
  }

  async edit(reviewId: string, patch: EditReviewInput): Promise<ReviewRecord> {
    const doc = await this.requireDoc(reviewId);

    const updatedAt = new Date();
    const update: Partial<ReviewDocument> = { updatedAt };
    if (patch.rating !== undefined) update.rating = patch.rating;
    if (patch.text !== undefined) update.text = patch.text;
    if (patch.containsSpoiler !== undefined) update.containsSpoiler = patch.containsSpoiler;

    await this.reviews.updateOne({ _id: doc._id }, { $set: update });
    return toRecord({ ...doc, ...update });
  }

  async delete(reviewId: string): Promise<void> {
    if (!ObjectId.isValid(reviewId)) {
      return;
    }
    await this.reviews.deleteOne({ _id: new ObjectId(reviewId) });
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    await this.reviews.deleteOne({ sessionId });
  }

  async getAggregatesByBook(bookId: string): Promise<ReviewAggregates> {
    const [result] = await this.reviews
      .aggregate<{ averageRating: number; reviewCount: number }>([
        { $match: { bookId } },
        { $group: { _id: null, averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
      ])
      .toArray();

    if (!result) {
      return { averageRating: null, reviewCount: 0 };
    }

    return {
      averageRating: roundToOneDecimal(result.averageRating),
      reviewCount: result.reviewCount,
    };
  }

  private async requireDoc(reviewId: string): Promise<ReviewDocument> {
    if (!ObjectId.isValid(reviewId)) {
      throw new ReviewNotFoundError();
    }
    const doc = await this.reviews.findOne({ _id: new ObjectId(reviewId) });
    if (!doc) {
      throw new ReviewNotFoundError();
    }
    return doc;
  }
}
