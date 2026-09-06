import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MongoShelfMembershipRepository } from '../../../../src/repositories/shelf-memberships';
import { ensureBookIndexes } from '../../../helpers/book-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const userId = '507f1f77bcf86cd799439011';
const bookId = '507f1f77bcf86cd799439022';
const otherBookId = '507f1f77bcf86cd799439033';

describe('MongoShelfMembershipRepository (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let repo: MongoShelfMembershipRepository;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('shelf_membership_repo_test');
    await ensureBookIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('shelf_memberships').deleteMany({});
    repo = new MongoShelfMembershipRepository(db);
  });

  it('add creates a membership; adding the same pair again does not duplicate (D6)', async () => {
    await repo.add(userId, bookId);
    await repo.add(userId, bookId);

    const count = await db
      .collection('shelf_memberships')
      .countDocuments({ userId, bookId });
    expect(count).toBe(1);
  });

  it('remove deletes the membership; removing again is not an error', async () => {
    await repo.add(userId, bookId);
    await repo.remove(userId, bookId);

    const count = await db.collection('shelf_memberships').countDocuments({ userId, bookId });
    expect(count).toBe(0);

    await expect(repo.remove(userId, bookId)).resolves.toBeUndefined();
  });

  it('list paginates by createdAt desc and returns nextCursor: null on the last page', async () => {
    await repo.add(userId, bookId);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await repo.add(userId, otherBookId);

    const firstPage = await repo.list(userId, null, 1);
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.items[0].bookId).toBe(otherBookId);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await repo.list(userId, firstPage.nextCursor, 1);
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].bookId).toBe(bookId);
    expect(secondPage.nextCursor).toBeNull();
  });

  it('list does not leak another user\'s memberships', async () => {
    await repo.add(userId, bookId);
    await repo.add('another-user', otherBookId);

    const page = await repo.list(userId, null, 10);
    expect(page.items.map((item) => item.bookId)).toEqual([bookId]);
  });

  it('listBookIdsForUser returns the distinct want-to-read bookIds of the user only', async () => {
    await repo.add(userId, bookId);
    await repo.add(userId, otherBookId);
    await repo.add('another-user', 'not-mine');

    const ids = await repo.listBookIdsForUser(userId);
    expect([...ids].sort()).toEqual([bookId, otherBookId].sort());
  });

  it('countForUser returns the number of want-to-read marks of the user only', async () => {
    expect(await repo.countForUser(userId)).toBe(0);

    await repo.add(userId, bookId);
    await repo.add(userId, otherBookId);
    await repo.add('another-user', 'not-mine');

    expect(await repo.countForUser(userId)).toBe(2);
  });
});
