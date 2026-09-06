import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  InvalidReadingSessionDatesError,
  InvalidReadingSessionStateError,
  ValidationError,
} from '../../../../src/errors';
import { MongoReadingSessionRepository } from '../../../../src/repositories/reading-sessions';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const userId = '507f1f77bcf86cd799439011';
const otherUserId = '507f1f77bcf86cd799439099';
const bookId = '507f1f77bcf86cd799439022';

describe('MongoReadingSessionRepository (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let repo: MongoReadingSessionRepository;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('reading_session_repo_test');
    await ensureBookIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('reading_sessions').deleteMany({});
    repo = new MongoReadingSessionRepository(db);
  });

  it('startReading creates a reading session with startedAt and no finishedAt', async () => {
    const startedAt = new Date('2025-01-01T00:00:00.000Z');
    const session = await repo.startReading(userId, bookId, startedAt);

    expect(session).toMatchObject({
      userId,
      bookId,
      status: 'reading',
      startedAt,
      finishedAt: null,
      currentPage: null,
    });
  });

  it('startReading reuses the already-open session instead of creating another (RF-009)', async () => {
    const first = await repo.startReading(userId, bookId, new Date('2025-01-01T00:00:00.000Z'));
    const second = await repo.startReading(userId, bookId, new Date('2025-01-02T00:00:00.000Z'));

    expect(second.id).toBe(first.id);
    expect(second.startedAt).toEqual(first.startedAt);

    const count = await db
      .collection('reading_sessions')
      .countDocuments({ userId, bookId, status: 'reading' });
    expect(count).toBe(1);
  });

  it('startReading allows different users to each have their own open session for the same book', async () => {
    const a = await repo.startReading(userId, bookId, new Date());
    const b = await repo.startReading(otherUserId, bookId, new Date());

    expect(a.id).not.toBe(b.id);
  });

  it('findOpenSession finds the reading session or returns null', async () => {
    expect(await repo.findOpenSession(userId, bookId)).toBeNull();

    const session = await repo.startReading(userId, bookId, new Date());
    expect(await repo.findOpenSession(userId, bookId)).toMatchObject({ id: session.id });

    await repo.finish(session.id, new Date());
    expect(await repo.findOpenSession(userId, bookId)).toBeNull();
  });

  it('createFinished always inserts a new session, even for a book already finished before (RF-016)', async () => {
    const first = await repo.createFinished(userId, bookId, {
      startedAt: null,
      finishedAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    const second = await repo.createFinished(userId, bookId, {
      startedAt: null,
      finishedAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    expect(second.id).not.toBe(first.id);
    const count = await db.collection('reading_sessions').countDocuments({ userId, bookId });
    expect(count).toBe(2);
  });

  it('createFinished accepts a null startedAt ("read it last year" — P10)', async () => {
    const session = await repo.createFinished(userId, bookId, {
      startedAt: null,
      finishedAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    expect(session.startedAt).toBeNull();
    expect(session.status).toBe('finished');
  });

  it('updateProgress sets currentPage on a reading session', async () => {
    const session = await repo.startReading(userId, bookId, new Date());
    const updated = await repo.updateProgress(session.id, 120);
    expect(updated.currentPage).toBe(120);
  });

  it('updateProgress rejects a session that is not reading (RF-012)', async () => {
    const session = await repo.createFinished(userId, bookId, {
      startedAt: null,
      finishedAt: new Date(),
    });
    await expect(repo.updateProgress(session.id, 10)).rejects.toBeInstanceOf(
      InvalidReadingSessionStateError,
    );
  });

  it('finish transitions reading -> finished and is idempotent afterwards', async () => {
    const session = await repo.startReading(userId, bookId, new Date());
    const finishedAt = new Date('2025-03-01T00:00:00.000Z');
    const finished = await repo.finish(session.id, finishedAt);

    expect(finished.status).toBe('finished');
    expect(finished.finishedAt).toEqual(finishedAt);

    const finishedAgain = new Date('2025-03-02T00:00:00.000Z');
    const reFinished = await repo.finish(session.id, finishedAgain);
    expect(reFinished.finishedAt).toEqual(finishedAgain);
  });

  it('edit updates startedAt/finishedAt/currentPage', async () => {
    const session = await repo.startReading(userId, bookId, new Date('2025-01-01T00:00:00.000Z'));
    const edited = await repo.edit(session.id, { currentPage: 42 });
    expect(edited.currentPage).toBe(42);
  });

  it('edit rejects a result with finishedAt before startedAt (RF-017)', async () => {
    const session = await repo.startReading(userId, bookId, new Date('2026-01-01T00:00:00.000Z'));
    await expect(
      repo.edit(session.id, { finishedAt: new Date('2025-01-01T00:00:00.000Z') }),
    ).rejects.toBeInstanceOf(InvalidReadingSessionDatesError);
  });

  it('delete removes the session', async () => {
    const session = await repo.startReading(userId, bookId, new Date());
    await repo.delete(session.id);
    expect(await repo.findById(session.id)).toBeNull();
  });

  it('listByUser paginates by createdAt desc and filters by bookId', async () => {
    const otherBookId = '507f1f77bcf86cd799439033';
    await repo.createFinished(userId, bookId, { startedAt: null, finishedAt: new Date('2024-01-01T00:00:00.000Z') });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await repo.createFinished(userId, otherBookId, { startedAt: null, finishedAt: new Date('2024-02-01T00:00:00.000Z') });

    const all = await repo.listByUser(userId, {}, null, 10);
    expect(all.items).toHaveLength(2);

    const filtered = await repo.listByUser(userId, { bookId }, null, 10);
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0].bookId).toBe(bookId);
  });

  describe('listByUser status filter and ordering (feature 010)', () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    async function seedMixedHistory() {
      // 2 finished, then 2 reading (distinct books to dodge the open-session unique index).
      await repo.createFinished(userId, '507f1f77bcf86cd7994300a1', {
        startedAt: null,
        finishedAt: new Date('2024-01-01T00:00:00.000Z'),
      });
      await sleep(5);
      await repo.createFinished(userId, '507f1f77bcf86cd7994300a2', {
        startedAt: null,
        finishedAt: new Date('2024-02-01T00:00:00.000Z'),
      });
      await sleep(5);
      await repo.startReading(userId, '507f1f77bcf86cd7994300b1', new Date());
      await sleep(5);
      await repo.startReading(userId, '507f1f77bcf86cd7994300b2', new Date());
    }

    it('orders all reading before all finished, then createdAt desc within each group (RF-023)', async () => {
      await seedMixedHistory();

      const page = await repo.listByUser(userId, {}, null, 10);

      expect(page.items.map((item) => item.status)).toEqual([
        'reading',
        'reading',
        'finished',
        'finished',
      ]);
      // newest-first inside each group
      expect(page.items[0].createdAt.getTime()).toBeGreaterThan(page.items[1].createdAt.getTime());
      expect(page.items[2].createdAt.getTime()).toBeGreaterThan(page.items[3].createdAt.getTime());
    });

    it('filters to a single status when asked (RF-021, RF-024)', async () => {
      await seedMixedHistory();

      const reading = await repo.listByUser(userId, { status: 'reading' }, null, 10);
      expect(reading.items.map((i) => i.status)).toEqual(['reading', 'reading']);

      const finished = await repo.listByUser(userId, { status: 'finished' }, null, 10);
      expect(finished.items.map((i) => i.status)).toEqual(['finished', 'finished']);
    });

    it('paginates by cursor across the reading→finished boundary without repetition or omission (RF-025)', async () => {
      await seedMixedHistory();

      const collected: string[] = [];
      let cursor: string | null = null;
      for (let i = 0; i < 5; i += 1) {
        const page: Awaited<ReturnType<typeof repo.listByUser>> = await repo.listByUser(
          userId,
          {},
          cursor,
          2,
        );
        collected.push(...page.items.map((item) => item.id));
        cursor = page.nextCursor;
        if (cursor === null) break;
      }

      expect(collected).toHaveLength(4);
      expect(new Set(collected).size).toBe(4);
    });

    it('rejects a cursor emitted before feature 010 (no status field)', async () => {
      const legacy = Buffer.from(
        JSON.stringify({ createdAt: new Date().toISOString(), id: '507f1f77bcf86cd799439011' }),
      ).toString('base64url');

      await expect(repo.listByUser(userId, {}, legacy, 10)).rejects.toBeInstanceOf(ValidationError);
    });
  });

  it('countDistinctFinishedReaders counts distinct users with a finished session of the book', async () => {
    await repo.createFinished(userId, bookId, { startedAt: null, finishedAt: new Date() });
    await repo.createFinished(userId, bookId, { startedAt: null, finishedAt: new Date() }); // reread, same user
    await repo.createFinished(otherUserId, bookId, { startedAt: null, finishedAt: new Date() });
    await repo.startReading('507f1f77bcf86cd799439088', bookId, new Date()); // reading, not finished

    expect(await repo.countDistinctFinishedReaders(bookId)).toBe(2);
  });

  describe('findLatestFinishedPerUserForBook', () => {
    it('returns an empty array for empty userIds without touching the database', async () => {
      await expect(repo.findLatestFinishedPerUserForBook(bookId, [])).resolves.toEqual([]);
    });

    it('returns at most one row per user: the most recent finished session of the book', async () => {
      await repo.createFinished(userId, bookId, {
        startedAt: null,
        finishedAt: new Date('2024-01-01T00:00:00.000Z'),
      });
      const latest = await repo.createFinished(userId, bookId, {
        startedAt: null,
        finishedAt: new Date('2024-06-01T00:00:00.000Z'),
      });
      await repo.createFinished(otherUserId, bookId, {
        startedAt: null,
        finishedAt: new Date('2024-03-01T00:00:00.000Z'),
      });

      const rows = await repo.findLatestFinishedPerUserForBook(bookId, [userId, otherUserId]);

      expect(rows).toHaveLength(2);
      const forUser = rows.find((row) => row.userId === userId);
      expect(forUser?.id).toBe(latest.id);
    });

    it('ignores reading sessions, other books, and users outside the list', async () => {
      await repo.startReading(userId, bookId, new Date()); // reading, not finished
      await repo.createFinished(userId, '507f1f77bcf86cd7994390ff', {
        startedAt: null,
        finishedAt: new Date(),
      }); // other book
      await repo.createFinished(otherUserId, bookId, { startedAt: null, finishedAt: new Date() });

      const rows = await repo.findLatestFinishedPerUserForBook(bookId, [userId]);
      expect(rows).toEqual([]);
    });
  });

  describe('listBookIdsForUser', () => {
    it('returns the distinct bookIds the user has any session for', async () => {
      await repo.startReading(userId, 'book-a', new Date());
      await repo.createFinished(userId, 'book-b', { startedAt: null, finishedAt: new Date() });
      await repo.createFinished(userId, 'book-b', { startedAt: null, finishedAt: new Date() }); // reread
      await repo.createFinished(otherUserId, 'book-c', { startedAt: null, finishedAt: new Date() });

      const ids = await repo.listBookIdsForUser(userId);
      expect([...ids].sort()).toEqual(['book-a', 'book-b']);
    });
  });

  describe('aggregatePopularBookIdsForReaders', () => {
    it('returns [] for empty readerIds without touching the database', async () => {
      await expect(repo.aggregatePopularBookIdsForReaders([], [], 20)).resolves.toEqual([]);
    });

    it('ranks by distinct readers, excludes given bookIds, and respects the limit', async () => {
      const r1 = '607f1f77bcf86cd799430001';
      const r2 = '607f1f77bcf86cd799430002';
      const stranger = '607f1f77bcf86cd799430099';

      // book-y: 2 distinct readers among [r1, r2]; book-z: 1; book-known: excluded
      await repo.createFinished(r1, 'book-y', { startedAt: null, finishedAt: new Date() });
      await repo.createFinished(r1, 'book-y', { startedAt: null, finishedAt: new Date() }); // reread, same reader
      await repo.createFinished(r2, 'book-y', { startedAt: null, finishedAt: new Date() });
      await repo.createFinished(r2, 'book-z', { startedAt: null, finishedAt: new Date() });
      await repo.createFinished(r1, 'book-known', { startedAt: null, finishedAt: new Date() });
      await repo.createFinished(stranger, 'book-y', { startedAt: null, finishedAt: new Date() }); // not a reader

      const ranked = await repo.aggregatePopularBookIdsForReaders([r1, r2], ['book-known'], 20);

      expect(ranked.map((row) => row.bookId)).toEqual(['book-y', 'book-z']);
      expect(ranked[0]).toMatchObject({ bookId: 'book-y', readerCount: 2 });
      expect(ranked[1]).toMatchObject({ bookId: 'book-z', readerCount: 1 });
      expect(ranked[0].lastActivityAt).toBeInstanceOf(Date);

      const capped = await repo.aggregatePopularBookIdsForReaders([r1, r2], [], 1);
      expect(capped).toHaveLength(1);
    });
  });
});
