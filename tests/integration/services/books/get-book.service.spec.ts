import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { BookNotFoundError, OpenLibraryUnavailableError } from '../../../../src/errors';
import { MongoBookRepository } from '../../../../src/repositories/books';
import { MongoReadingSessionRepository } from '../../../../src/repositories/reading-sessions';
import { makeGetBook } from '../../../../src/services/books';
import { aSearchResult, FakeOpenLibraryClient } from '../../../helpers/fake-open-library-client';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

describe('get-book service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let bookRepository: MongoBookRepository;
  let readingSessionRepository: MongoReadingSessionRepository;
  let openLibraryClient: FakeOpenLibraryClient;
  let getBook: ReturnType<typeof makeGetBook>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('get_book_service_test');
    await ensureBookIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('books').deleteMany({});
    await db.collection('reading_sessions').deleteMany({});
    bookRepository = new MongoBookRepository(db);
    readingSessionRepository = new MongoReadingSessionRepository(db);
    openLibraryClient = new FakeOpenLibraryClient();
    getBook = makeGetBook({ bookRepository, openLibraryClient, readingSessionRepository });
  });

  it('returns the cached book without calling the client when already cached', async () => {
    await bookRepository.upsertByOlid(aSearchResult());
    // Not seeding the fake client — a call to it would return null/throw and fail the assertion below.

    const result = await getBook({ olid: 'OL12345W' });
    expect(result).toMatchObject({ olid: 'OL12345W', title: 'Duna' });
  });

  it('resolves and caches the book on first interaction when not cached (RF-003)', async () => {
    openLibraryClient.seed(aSearchResult());

    const result = await getBook({ olid: 'OL12345W' });
    expect(result).toMatchObject({ olid: 'OL12345W', title: 'Duna' });

    const cached = await bookRepository.findByOlid('OL12345W');
    expect(cached).not.toBeNull();
  });

  it('throws BookNotFoundError when the client finds nothing', async () => {
    await expect(getBook({ olid: 'OL_GHOST_W' })).rejects.toBeInstanceOf(BookNotFoundError);
  });

  it('propagates OpenLibraryUnavailableError from the client', async () => {
    openLibraryClient.simulateOutage();
    await expect(getBook({ olid: 'OL12345W' })).rejects.toBeInstanceOf(OpenLibraryUnavailableError);
  });

  it('computes aggregates: averageRating null, reviewCount 0, readerCount from finished sessions', async () => {
    const book = await bookRepository.upsertByOlid(aSearchResult());
    await readingSessionRepository.createFinished('user-1', book.id, {
      startedAt: null,
      finishedAt: new Date(),
    });
    await readingSessionRepository.createFinished('user-2', book.id, {
      startedAt: null,
      finishedAt: new Date(),
    });

    const result = await getBook({ olid: 'OL12345W' });
    expect(result.aggregates).toEqual({ averageRating: null, reviewCount: 0, readerCount: 2 });
  });
});
