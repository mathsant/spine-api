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

  it('updates the password hash and bumps updatedAt', async () => {
    const created = await repo.create(input);
    const later = new Date(created.updatedAt.getTime() + 1000);

    await repo.updatePasswordHash(created.id, 'scrypt$1$1$1$bmV3$bmV3', later);

    const reloaded = await repo.findById(created.id);
    expect(reloaded?.passwordHash).toBe('scrypt$1$1$1$bmV3$bmV3');
    expect(reloaded?.updatedAt.getTime()).toBe(later.getTime());
  });
});
