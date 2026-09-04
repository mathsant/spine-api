import { type Db, MongoServerError, ObjectId } from 'mongodb';

import { EmailAlreadyInUseError, HandleAlreadyInUseError } from '../../errors';
import type {
  CreateUserInput,
  UpdateProfileInput,
  UserRecord,
  UserRepository,
  UserSearchPage,
} from './user.repository';

interface UserDocument {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  handle: string;
  displayName: string;
  bio?: string | null;
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
    bio: doc.bio ?? null,
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
      bio: null,
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

  async updateProfile(id: string, patch: UpdateProfileInput, now: Date): Promise<UserRecord> {
    const objectId = new ObjectId(id);
    await this.users.updateOne(
      { _id: objectId },
      { $set: { ...patch, updatedAt: now } },
    );
    const doc = await this.users.findOne({ _id: objectId });
    if (!doc) {
      throw new Error(`User ${id} not found after updateProfile`);
    }
    return toRecord(doc);
  }

  async search(query: string, page: number, limit: number): Promise<UserSearchPage> {
    const filter = { $text: { $search: query } };
    const skip = (page - 1) * limit;

    const [docs, totalItems] = await Promise.all([
      this.users
        .find(filter, { projection: { score: { $meta: 'textScore' } } })
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.users.countDocuments(filter),
    ]);

    return {
      items: docs.map((doc) => ({ id: doc._id.toHexString(), handle: doc.handle, displayName: doc.displayName })),
      page,
      limit,
      totalItems,
    };
  }
}
