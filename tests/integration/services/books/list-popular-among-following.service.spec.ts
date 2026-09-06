import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoBookRepository } from '../../../../src/repositories/books';
import { MongoFollowRepository } from '../../../../src/repositories/follows';
import { MongoReadingSessionRepository } from '../../../../src/repositories/reading-sessions';
import { MongoShelfMembershipRepository } from '../../../../src/repositories/shelf-memberships';
import { makeListPopularAmongFollowing } from '../../../../src/services/books';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { ensureFollowIndexes } from '../../../helpers/follow-indexes';
import { aSearchResult } from '../../../helpers/fake-open-library-client';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const me = '507f1f77bcf86cd799439001';
const ana = '507f1f77bcf86cd799439002';
const bruno = '507f1f77bcf86cd799439003';
const dora = '507f1f77bcf86cd799439004';
const stranger = '507f1f77bcf86cd799439099';

describe('list-popular-among-following service (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let bookRepository: MongoBookRepository;
  let followRepository: MongoFollowRepository;
  let readingSessionRepository: MongoReadingSessionRepository;
  let shelfMembershipRepository: MongoShelfMembershipRepository;
  let listPopular: ReturnType<typeof makeListPopularAmongFollowing>;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('list_popular_among_following_service_test');
    await ensureBookIndexes(db);
    await ensureFollowIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      ['books', 'follows', 'reading_sessions', 'shelf_memberships'].map((c) =>
        db.collection(c).deleteMany({}),
      ),
    );
    bookRepository = new MongoBookRepository(db);
    followRepository = new MongoFollowRepository(db);
    readingSessionRepository = new MongoReadingSessionRepository(db);
    shelfMembershipRepository = new MongoShelfMembershipRepository(db);
    listPopular = makeListPopularAmongFollowing({
      followRepository,
      readingSessionRepository,
      shelfMembershipRepository,
      bookRepository,
    });
  });

  async function aBook(olid: string, title = olid) {
    return bookRepository.upsertByOlid(aSearchResult({ olid, isbn13: null, title }));
  }

  it('ranks by distinct followed readers and returns BookSearchResult items with pageCount (RF-014, RF-018)', async () => {
    await followRepository.create(me, ana, new Date());
    await followRepository.create(me, bruno, new Date());
    await followRepository.create(me, dora, new Date());
    const y = await aBook('OL_Y_W', 'Livro Y');
    const z = await aBook('OL_Z_W', 'Livro Z');

    await readingSessionRepository.createFinished(ana.toString(), y.id, {
      startedAt: null,
      finishedAt: new Date(),
    });
    await readingSessionRepository.startReading(bruno.toString(), y.id, new Date());
    await readingSessionRepository.createFinished(dora.toString(), z.id, {
      startedAt: null,
      finishedAt: new Date(),
    });

    const result = await listPopular({ userId: me });

    expect(result.items.map((item) => item.olid)).toEqual(['OL_Y_W', 'OL_Z_W']);
    expect(result.items[0]).toMatchObject({ title: 'Livro Y', pageCount: 412 });
    expect(result).not.toHaveProperty('nextCursor');
  });

  it('excludes books the caller already has a session or a want-to-read mark for (RF-016)', async () => {
    await followRepository.create(me, ana, new Date());
    const y = await aBook('OL_Y_W');
    const known = await aBook('OL_KNOWN_W');
    const shelved = await aBook('OL_SHELVED_W');

    await readingSessionRepository.createFinished(ana.toString(), y.id, {
      startedAt: null,
      finishedAt: new Date(),
    });
    await readingSessionRepository.createFinished(ana.toString(), known.id, {
      startedAt: null,
      finishedAt: new Date(),
    });
    await readingSessionRepository.createFinished(ana.toString(), shelved.id, {
      startedAt: null,
      finishedAt: new Date(),
    });
    await readingSessionRepository.startReading(me.toString(), known.id, new Date());
    await shelfMembershipRepository.add(me.toString(), shelved.id);

    const result = await listPopular({ userId: me });
    expect(result.items.map((item) => item.olid)).toEqual(['OL_Y_W']);
  });

  it('does not count sessions of users the caller does not follow (P6, RF-020)', async () => {
    await followRepository.create(me, ana, new Date());
    const y = await aBook('OL_Y_W');

    await readingSessionRepository.createFinished(stranger.toString(), y.id, {
      startedAt: null,
      finishedAt: new Date(),
    });

    const result = await listPopular({ userId: me });
    expect(result.items).toEqual([]);
  });

  it('caps the list at 20 items (RF-017)', async () => {
    await followRepository.create(me, ana, new Date());
    for (let i = 0; i < 25; i += 1) {
      const book = await aBook(`OL_${i}_W`);
      await readingSessionRepository.createFinished(ana.toString(), book.id, {
        startedAt: null,
        finishedAt: new Date(),
      });
    }

    const result = await listPopular({ userId: me });
    expect(result.items).toHaveLength(20);
  });

  it('returns an empty list when the caller follows nobody (RF-019)', async () => {
    const result = await listPopular({ userId: me });
    expect(result).toEqual({ items: [] });
  });

  it('returns an empty list when followed users have no sessions (RF-019)', async () => {
    await followRepository.create(me, ana, new Date());
    const result = await listPopular({ userId: me });
    expect(result).toEqual({ items: [] });
  });
});
