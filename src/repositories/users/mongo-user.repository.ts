import { type Db, MongoServerError, ObjectId } from 'mongodb';

import { EmailAlreadyInUseError, HandleAlreadyInUseError } from '../../errors';
import type { CreateUserInput, UserRecord, UserRepository } from './user.repository';

interface UserDocument {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  handle: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

const DUPLICATE_KEY = 11000;

function toRecord(doc: UserDocument): UserRecord {
  return {
    id: doc._id.toHexString(),
    email: doc.email,
    passwordHash: doc.passwordHash,
    handle: doc.handle,
    displayName: doc.displayName,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoUserRepository implements UserRepository {
  private readonly users;

  constructor(db: Db) {
    this.users = db.collection<UserDocument>('users');
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const now = new Date();
    const doc: UserDocument = {
      _id: new ObjectId(),
      email: input.email,
      passwordHash: input.passwordHash,
      handle: input.handle,
      displayName: input.displayName,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.users.insertOne(doc);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
        const keys = Object.keys((error.keyPattern as Record<string, unknown> | undefined) ?? {});
        if (keys.includes('handle')) {
          throw new HandleAlreadyInUseError();
        }
        throw new EmailAlreadyInUseError();
      }
      throw error;
    }

    return toRecord(doc);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const doc = await this.users.findOne({ email });
    return doc ? toRecord(doc) : null;
  }

  async findByHandle(handle: string): Promise<UserRecord | null> {
    const doc = await this.users.findOne({ handle });
    return doc ? toRecord(doc) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }
    const doc = await this.users.findOne({ _id: new ObjectId(id) });
    return doc ? toRecord(doc) : null;
  }

  async updatePasswordHash(id: string, passwordHash: string, now: Date): Promise<void> {
    if (!ObjectId.isValid(id)) {
      return;
    }
    await this.users.updateOne(
      { _id: new ObjectId(id) },
      { $set: { passwordHash, updatedAt: now } },
    );
  }
}
