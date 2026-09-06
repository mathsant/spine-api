import type { Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { EmailAlreadyInUseError, HandleAlreadyInUseError } from '../../../../src/errors';
import { MongoUserRepository } from '../../../../src/repositories/users';
import { ensureAuthIndexes } from '../../../helpers/auth-indexes';
import { type MongoMemory, startMongoMemory } from '../../../helpers/mongo-memory';

const input = {
  email: 'alice@example.com',
  passwordHash: 'scrypt$1$1$1$c2FsdA==$aGFzaA==',
  handle: 'alice',
  displayName: 'Alice',
};

describe('MongoUserRepository (integration)', () => {
  let mongo: MongoMemory;
  let db: Db;
  let repo: MongoUserRepository;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    db = mongo.client.db('user_repo_test');
    await ensureAuthIndexes(db);
  });

  afterAll(async () => {
    await mongo.stop();
  });

  beforeEach(async () => {
    await db.collection('users').deleteMany({});
    repo = new MongoUserRepository(db);
  });

  it('creates a user and returns a record with a string id and timestamps', async () => {
    const record = await repo.create(input);

    expect(typeof record.id).toBe('string');
    expect(record.id).toHaveLength(24);
    expect(record).toMatchObject({ email: 'alice@example.com', handle: 'alice', displayName: 'Alice' });
    expect(record.createdAt).toBeInstanceOf(Date);
    expect(record.updatedAt).toBeInstanceOf(Date);
  });

  it('translates a duplicate email into EmailAlreadyInUseError', async () => {
    await repo.create(input);
    await expect(repo.create({ ...input, handle: 'other' })).rejects.toBeInstanceOf(
      EmailAlreadyInUseError,
    );
  });

  it('translates a duplicate handle into HandleAlreadyInUseError', async () => {
    await repo.create(input);
    await expect(repo.create({ ...input, email: 'other@example.com' })).rejects.toBeInstanceOf(
      HandleAlreadyInUseError,
    );
  });

  it('finds by email, handle and id, and returns null when absent', async () => {
    const created = await repo.create(input);

    expect(await repo.findByEmail('alice@example.com')).toMatchObject({ id: created.id });
    expect(await repo.findByHandle('alice')).toMatchObject({ id: created.id });
    expect(await repo.findById(created.id)).toMatchObject({ id: created.id });

    expect(await repo.findByEmail('ghost@example.com')).toBeNull();
    expect(await repo.findByHandle('ghost')).toBeNull();
    expect(await repo.findById('012345678901234567890123')).toBeNull();
  });

  it('returns null for a malformed id rather than throwing', async () => {
    expect(await repo.findById('not-an-object-id')).toBeNull();
  });

  it('findByIds returns the records for the given ids, ignoring unknown and malformed ids', async () => {
    const alice = await repo.create(input);
    const bob = await repo.create({ ...input, email: 'bob@example.com', handle: 'bob' });

    expect(await repo.findByIds([])).toEqual([]);

    const found = await repo.findByIds([
      bob.id,
      alice.id,
      '012345678901234567890123', // well-formed but unknown
      'not-an-object-id', // malformed
    ]);
    expect(found.map((u) => u.id).sort()).toEqual([alice.id, bob.id].sort());

    expect(await repo.findByIds(['not-an-object-id'])).toEqual([]);
  });

  it('updates the password hash and bumps updatedAt', async () => {
    const created = await repo.create(input);
    const later = new Date(created.updatedAt.getTime() + 1000);

    await repo.updatePasswordHash(created.id, 'scrypt$1$1$1$bmV3$bmV3', later);

    const reloaded = await repo.findById(created.id);
    expect(reloaded?.passwordHash).toBe('scrypt$1$1$1$bmV3$bmV3');
    expect(reloaded?.updatedAt.getTime()).toBe(later.getTime());
  });

  it('creates a user with bio: null by default', async () => {
    const record = await repo.create(input);
    expect(record.bio).toBeNull();
  });

  it('updateProfile only touches the keys present in patch, plus updatedAt', async () => {
    const created = await repo.create(input);
    const later = new Date(created.updatedAt.getTime() + 1000);

    const afterBio = await repo.updateProfile(created.id, { bio: 'Reading sci-fi' }, later);
    expect(afterBio.bio).toBe('Reading sci-fi');
    expect(afterBio.displayName).toBe('Alice');
    expect(afterBio.updatedAt.getTime()).toBe(later.getTime());

    const evenLater = new Date(later.getTime() + 1000);
    const afterDisplayName = await repo.updateProfile(
      created.id,
      { displayName: 'Alice Reader' },
      evenLater,
    );
    expect(afterDisplayName.displayName).toBe('Alice Reader');
    expect(afterDisplayName.bio).toBe('Reading sci-fi');
    expect(afterDisplayName.email).toBe('alice@example.com');
    expect(afterDisplayName.handle).toBe('alice');
  });

  it('search finds by displayName and by handle, ranked by relevance, paginated', async () => {
    // MongoDB $text matches whole tokens, not substrings — "reader" matches a "Reader" word,
    // not an unbroken token like "bobreader" that merely contains those letters.
    await repo.create({ ...input, email: 'alice@example.com', handle: 'alice', displayName: 'Alice Reader' });
    await repo.create({ ...input, email: 'bob@example.com', handle: 'bobreader', displayName: 'Bob Reader' });
    await repo.create({ ...input, email: 'carol@example.com', handle: 'carol', displayName: 'Carol' });

    const byDisplayName = await repo.search('Alice', 1, 20);
    expect(byDisplayName.items).toHaveLength(1);
    expect(byDisplayName.items[0]).toMatchObject({ handle: 'alice', displayName: 'Alice Reader' });
    expect(byDisplayName.totalItems).toBe(1);

    const byHandle = await repo.search('bobreader', 1, 20);
    expect(byHandle.items).toHaveLength(1);
    expect(byHandle.items[0]).toMatchObject({ handle: 'bobreader' });

    const paged = await repo.search('reader', 1, 1);
    expect(paged.items).toHaveLength(1);
    expect(paged.totalItems).toBe(2);
    expect(paged.page).toBe(1);
    expect(paged.limit).toBe(1);

    const noMatch = await repo.search('nonexistent-term-xyz', 1, 20);
    expect(noMatch.items).toEqual([]);
    expect(noMatch.totalItems).toBe(0);
  });
});
