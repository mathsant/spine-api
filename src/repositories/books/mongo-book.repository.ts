import { type Db, ObjectId } from 'mongodb';

import type { BookRecord, BookRepository, UpsertBookInput } from './book.repository';

interface BookDocument {
  _id: ObjectId;
  olid: string;
  isbn13: string | null;
  title: string;
  authors: string[];
  coverUrl: string | null;
  firstPublishYear: number | null;
  createdAt: Date;
  updatedAt: Date;
}

function toRecord(doc: BookDocument): BookRecord {
  return {
    id: doc._id.toHexString(),
    olid: doc.olid,
    isbn13: doc.isbn13 ?? null,
    title: doc.title,
    authors: doc.authors,
    coverUrl: doc.coverUrl,
    firstPublishYear: doc.firstPublishYear,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoBookRepository implements BookRepository {
  private readonly books;

  constructor(db: Db) {
    this.books = db.collection<BookDocument>('books');
  }

  async findByOlid(olid: string): Promise<BookRecord | null> {
    const doc = await this.books.findOne({ olid });
    return doc ? toRecord(doc) : null;
  }

  async findById(id: string): Promise<BookRecord | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }
    const doc = await this.books.findOne({ _id: new ObjectId(id) });
    return doc ? toRecord(doc) : null;
  }

  async upsertByOlid(input: UpsertBookInput): Promise<BookRecord> {
    const now = new Date();

    // `isbn13` is only ever included in the document when present: the unique index on
    // it is sparse, and a sparse index still indexes an explicit `null`, which would
    // collide across every book with no ISBN. Omitting the field entirely keeps it out
    // of the index instead.
    await this.books.updateOne(
      { olid: input.olid },
      {
        $set: {
          ...(input.isbn13 !== null ? { isbn13: input.isbn13 } : {}),
          title: input.title,
          authors: input.authors,
          coverUrl: input.coverUrl,
          firstPublishYear: input.firstPublishYear,
          updatedAt: now,
        },
        ...(input.isbn13 === null ? { $unset: { isbn13: '' as const } } : {}),
        $setOnInsert: { _id: new ObjectId(), olid: input.olid, createdAt: now },
      },
      { upsert: true },
    );

    const doc = await this.books.findOne({ olid: input.olid });
    if (!doc) {
      throw new Error('upsertByOlid: document not found immediately after upsert');
    }
    return toRecord(doc);
  }
}
