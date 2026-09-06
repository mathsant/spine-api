import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoBookRepository } from '../../../../src/repositories/books';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const input = {
  olid: 'OL12345W',
  isbn13: '9780441013593',
  title: 'Duna',
  authors: ['Frank Herbert'],
  coverUrl: 'https://covers.openlibrary.org/b/id/999-M.jpg',
  firstPublishYear: 1965,
  pageCount: 412,
};

describe('MongoBookRepository (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let repo: MongoBookRepository;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('book_repo_test');
    await ensureBookIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('books').deleteMany({});
    repo = new MongoBookRepository(db);
  });

  it('creates a book on the first upsertByOlid and returns a string id + timestamps', async () => {
    const record = await repo.upsertByOlid(input);

    expect(typeof record.id).toBe('string');
    expect(record).toMatchObject(input);
    expect(record.createdAt).toBeInstanceOf(Date);
    expect(record.updatedAt).toBeInstanceOf(Date);
  });

  it('updates instead of duplicating on a second upsertByOlid with the same olid', async () => {
    const first = await repo.upsertByOlid(input);
    const second = await repo.upsertByOlid({ ...input, title: 'Duna (nova edição)' });

    expect(second.id).toBe(first.id);
    expect(second.title).toBe('Duna (nova edição)');
    expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());

    const count = await db.collection('books').countDocuments({ olid: input.olid });
    expect(count).toBe(1);
  });

  it('finds by olid and by id, and returns null when absent', async () => {
    const created = await repo.upsertByOlid(input);

    expect(await repo.findByOlid(input.olid)).toMatchObject({ id: created.id });
    expect(await repo.findById(created.id)).toMatchObject({ olid: input.olid });

    expect(await repo.findByOlid('OL_GHOST_W')).toBeNull();
    expect(await repo.findById('012345678901234567890123')).toBeNull();
  });

  it('returns null for a malformed id rather than throwing', async () => {
    expect(await repo.findById('not-an-object-id')).toBeNull();
  });

  it('persists pageCount and writes null when Open Library has none', async () => {
    const withCount = await repo.upsertByOlid({
      ...input,
      olid: 'OL_PAGES_W',
      isbn13: null,
      pageCount: 320,
    });
    expect(withCount.pageCount).toBe(320);

    const withoutCount = await repo.upsertByOlid({
      ...input,
      olid: 'OL_NO_PAGES_W',
      isbn13: null,
      pageCount: null,
    });
    expect(withoutCount.pageCount).toBeNull();
  });

  it('surfaces pageCount as null for a document cached before the field existed', async () => {
    await db.collection('books').insertOne({
      olid: 'OL_LEGACY_W',
      title: 'Legado',
      authors: [],
      coverUrl: null,
      firstPublishYear: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const found = await repo.findByOlid('OL_LEGACY_W');
    expect(found?.pageCount).toBeNull();
  });

  it('accepts a book with no isbn13 (sparse unique index)', async () => {
    const record = await repo.upsertByOlid({ ...input, olid: 'OL_NO_ISBN_W', isbn13: null });
    expect(record.isbn13).toBeNull();

    const another = await repo.upsertByOlid({ ...input, olid: 'OL_NO_ISBN_2W', isbn13: null });
    expect(another.isbn13).toBeNull();
  });
});
