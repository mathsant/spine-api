import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MongoBookRepository } from '../../../../src/repositories/books';
import { MongoReadingSessionRepository } from '../../../../src/repositories/reading-sessions';
import { MongoReviewRepository } from '../../../../src/repositories/reviews';
import { makeListReadingSessions } from '../../../../src/services/reading-sessions';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { ensureReviewIndexes } from '../../../helpers/review-indexes';
import { aSearchResult } from '../../../helpers/fake-open-library-client';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const userId = '507f1f77bcf86cd799439011';
const bookId = '507f1f77bcf86cd799439022';
const otherBookId = '507f1f77bcf86cd799439033';

describe('list-reading-sessions service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let readingSessionRepository: MongoReadingSessionRepository;
  let reviewRepository: MongoReviewRepository;
  let bookRepository: MongoBookRepository;
  let listReadingSessions: ReturnType<typeof makeListReadingSessions>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('list_reading_sessions_service_test');
    await ensureBookIndexes(db);
    await ensureReviewIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('reading_sessions').deleteMany({});
    await db.collection('reviews').deleteMany({});
    await db.collection('books').deleteMany({});
    readingSessionRepository = new MongoReadingSessionRepository(db);
    reviewRepository = new MongoReviewRepository(db);
    bookRepository = new MongoBookRepository(db);
    listReadingSessions = makeListReadingSessions({
      readingSessionRepository,
      reviewRepository,
      bookRepository,
    });
  });

  it('paginates the history across all statuses and books', async () => {
    await readingSessionRepository.createFinished(userId, bookId, { startedAt: null, finishedAt: new Date('2024-01-01T00:00:00.000Z') });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await readingSessionRepository.startReading(userId, otherBookId, new Date('2024-02-01T00:00:00.000Z'));

    const page = await listReadingSessions({ userId, cursor: null, limit: 20 });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  it('includes rereads of the same book (multiple finished sessions)', async () => {
    await readingSessionRepository.createFinished(userId, bookId, { startedAt: null, finishedAt: new Date('2024-01-01T00:00:00.000Z') });
    await readingSessionRepository.createFinished(userId, bookId, { startedAt: null, finishedAt: new Date('2025-01-01T00:00:00.000Z') });

    const page = await listReadingSessions({ userId, bookId, cursor: null, limit: 20 });
    expect(page.items).toHaveLength(2);
  });

  it('filters by bookId when provided', async () => {
    await readingSessionRepository.createFinished(userId, bookId, { startedAt: null, finishedAt: new Date() });
    await readingSessionRepository.createFinished(userId, otherBookId, { startedAt: null, finishedAt: new Date() });

    const page = await listReadingSessions({ userId, bookId, cursor: null, limit: 20 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].bookId).toBe(bookId);
  });

  it('embeds the review of a session that has one, and null otherwise (RF-010)', async () => {
    const reviewed = await readingSessionRepository.createFinished(userId, bookId, {
      startedAt: null,
      finishedAt: new Date(),
    });
    const unreviewed = await readingSessionRepository.createFinished(userId, otherBookId, {
      startedAt: null,
      finishedAt: new Date(),
    });
    await reviewRepository.create(userId, reviewed.id, bookId, { rating: 4 });

    const page = await listReadingSessions({ userId, cursor: null, limit: 20 });

    const reviewedItem = page.items.find((item) => item.id === reviewed.id);
    const unreviewedItem = page.items.find((item) => item.id === unreviewed.id);
    expect(reviewedItem?.review).toMatchObject({ rating: 4 });
    expect(unreviewedItem?.review).toBeNull();
  });

  describe('status filter and ordering (feature 010)', () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    async function seedMixedHistory() {
      await readingSessionRepository.createFinished(userId, '507f1f77bcf86cd7994300a1', {
        startedAt: null,
        finishedAt: new Date('2024-01-01T00:00:00.000Z'),
      });
      await sleep(5);
      await readingSessionRepository.createFinished(userId, '507f1f77bcf86cd7994300a2', {
        startedAt: null,
        finishedAt: new Date('2024-02-01T00:00:00.000Z'),
      });
      await sleep(5);
      await readingSessionRepository.startReading(userId, '507f1f77bcf86cd7994300b1', new Date());
      await sleep(5);
      await readingSessionRepository.startReading(userId, '507f1f77bcf86cd7994300b2', new Date());
    }

    it('returns reading sessions before finished ones, createdAt desc within each group (RF-023)', async () => {
      await seedMixedHistory();
      const page = await listReadingSessions({ userId, cursor: null, limit: 20 });
      expect(page.items.map((item) => item.status)).toEqual([
        'reading',
        'reading',
        'finished',
        'finished',
      ]);
    });

    it('filters server-side by status (RF-021, RF-024)', async () => {
      await seedMixedHistory();
      const reading = await listReadingSessions({ userId, status: 'reading', cursor: null, limit: 20 });
      const finished = await listReadingSessions({ userId, status: 'finished', cursor: null, limit: 20 });
      expect(reading.items.map((i) => i.status)).toEqual(['reading', 'reading']);
      expect(finished.items.map((i) => i.status)).toEqual(['finished', 'finished']);
    });

    it('applies bookId and status together (RF-026)', async () => {
      await readingSessionRepository.startReading(userId, bookId, new Date());
      await readingSessionRepository.createFinished(userId, bookId, {
        startedAt: null,
        finishedAt: new Date(),
      });

      const page = await listReadingSessions({
        userId,
        bookId,
        status: 'finished',
        cursor: null,
        limit: 20,
      });
      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toMatchObject({ bookId, status: 'finished' });
    });

    it('keeps cursor pagination stable across the reading→finished boundary (RF-025)', async () => {
      await seedMixedHistory();

      const seen: string[] = [];
      let cursor: string | null = null;
      for (let i = 0; i < 5; i += 1) {
        const page = await listReadingSessions({ userId, cursor, limit: 2 });
        seen.push(...page.items.map((item) => item.id));
        cursor = page.nextCursor;
        if (cursor === null) break;
      }
      expect(seen).toHaveLength(4);
      expect(new Set(seen).size).toBe(4);
    });
  });

  describe('embedded book summary (feature 010)', () => {
    it('embeds a book summary in every item (RF-028)', async () => {
      const book = await bookRepository.upsertByOlid(
        aSearchResult({ olid: 'OL_HIST_W', isbn13: null, title: 'Historia', pageCount: 275 }),
      );
      await readingSessionRepository.createFinished(userId, book.id, {
        startedAt: null,
        finishedAt: new Date(),
      });

      const page = await listReadingSessions({ userId, cursor: null, limit: 20 });

      expect(page.items[0].book).toEqual({
        olid: 'OL_HIST_W',
        title: 'Historia',
        authors: book.authors,
        coverUrl: book.coverUrl,
        pageCount: 275,
      });
    });

    it('resolves books in a single batch, not one query per item (RF-030)', async () => {
      const book = await bookRepository.upsertByOlid(
        aSearchResult({ olid: 'OL_BATCH_W', isbn13: null, title: 'Batch' }),
      );
      await readingSessionRepository.createFinished(userId, book.id, {
        startedAt: null,
        finishedAt: new Date('2024-01-01T00:00:00.000Z'),
      });
      await readingSessionRepository.createFinished(userId, book.id, {
        startedAt: null,
        finishedAt: new Date('2025-01-01T00:00:00.000Z'),
      });

      const findById = vi.spyOn(bookRepository, 'findById');
      await listReadingSessions({ userId, cursor: null, limit: 20 });

      // two sessions of the same book -> one lookup
      expect(findById).toHaveBeenCalledTimes(1);
    });
  });
});
