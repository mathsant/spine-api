import { type Db, MongoError, ObjectId } from 'mongodb';

import { DatabaseUnavailableError } from '../../errors';
import type {
  AuthSessionRecord,
  AuthSessionRepository,
  CreateSessionInput,
  RefreshTokenRecord,
  RevokedReason,
  RotateInput,
} from './auth-session.repository';

interface AuthSessionDocument {
  _id: ObjectId;
  userId: ObjectId;
  status: 'active' | 'revoked';
  createdAt: Date;
  lastUsedAt: Date;
  inactivityExpiresAt: Date;
  revokedAt?: Date;
  revokedReason?: RevokedReason;
}

interface RefreshTokenDocument {
  _id: ObjectId;
  sessionId: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  createdAt: Date;
  rotatedAt: Date | null;
  expiresAt: Date;
}

function toSession(doc: AuthSessionDocument): AuthSessionRecord {
  return {
    sessionId: doc._id.toHexString(),
    userId: doc.userId.toHexString(),
    status: doc.status,
    createdAt: doc.createdAt,
    lastUsedAt: doc.lastUsedAt,
    inactivityExpiresAt: doc.inactivityExpiresAt,
    ...(doc.revokedReason ? { revokedReason: doc.revokedReason } : {}),
  };
}

function toLink(doc: RefreshTokenDocument): RefreshTokenRecord {
  return {
    id: doc._id.toHexString(),
    sessionId: doc.sessionId.toHexString(),
    userId: doc.userId.toHexString(),
    tokenHash: doc.tokenHash,
    createdAt: doc.createdAt,
    rotatedAt: doc.rotatedAt,
    expiresAt: doc.expiresAt,
  };
}

/** Runs a driver operation, converting any raw driver error into a domain error (P5). */
async function run<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (error) {
    if (error instanceof MongoError) {
      throw new DatabaseUnavailableError('Auth session store is unavailable', { cause: error });
    }
    throw error;
  }
}

export class MongoAuthSessionRepository implements AuthSessionRepository {
  private readonly sessions;
  private readonly links;

  constructor(db: Db) {
    this.sessions = db.collection<AuthSessionDocument>('auth_sessions');
    this.links = db.collection<RefreshTokenDocument>('refresh_tokens');
  }

  async createSession(input: CreateSessionInput): Promise<{ sessionId: string }> {
    const sessionId = new ObjectId();
    const userId = new ObjectId(input.userId);

    await run(() =>
      this.sessions.insertOne({
        _id: sessionId,
        userId,
        status: 'active',
        createdAt: input.now,
        lastUsedAt: input.now,
        inactivityExpiresAt: input.inactivityExpiresAt,
      }),
    );
    await run(() =>
      this.links.insertOne({
        _id: new ObjectId(),
        sessionId,
        userId,
        tokenHash: input.refreshTokenHash,
        createdAt: input.now,
        rotatedAt: null,
        expiresAt: input.refreshExpiresAt,
      }),
    );

    return { sessionId: sessionId.toHexString() };
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const doc = await run(() => this.links.findOne({ tokenHash }));
    return doc ? toLink(doc) : null;
  }

  async findSessionById(sessionId: string): Promise<AuthSessionRecord | null> {
    if (!ObjectId.isValid(sessionId)) {
      return null;
    }
    const doc = await run(() => this.sessions.findOne({ _id: new ObjectId(sessionId) }));
    return doc ? toSession(doc) : null;
  }

  async rotate(input: RotateInput): Promise<{ rotated: boolean }> {
    const stamped = await run(() =>
      this.links.updateOne(
        { _id: new ObjectId(input.currentTokenId), rotatedAt: null },
        { $set: { rotatedAt: input.now } },
      ),
    );
    if (stamped.modifiedCount !== 1) {
      return { rotated: false };
    }

    await run(() =>
      this.links.insertOne({
        _id: new ObjectId(),
        sessionId: new ObjectId(input.sessionId),
        userId: new ObjectId(input.userId),
        tokenHash: input.newTokenHash,
        createdAt: input.now,
        rotatedAt: null,
        expiresAt: input.refreshExpiresAt,
      }),
    );
    await run(() =>
      this.sessions.updateOne(
        { _id: new ObjectId(input.sessionId) },
        { $set: { lastUsedAt: input.now, inactivityExpiresAt: input.inactivityExpiresAt } },
      ),
    );

    return { rotated: true };
  }

  async revokeSession(sessionId: string, reason: RevokedReason): Promise<void> {
    if (!ObjectId.isValid(sessionId)) {
      return;
    }
    await run(() =>
      this.sessions.updateOne(
        { _id: new ObjectId(sessionId), status: 'active' },
        { $set: { status: 'revoked', revokedAt: new Date(), revokedReason: reason } },
      ),
    );
  }

  async revokeAllUserSessions(
    userId: string,
    reason: RevokedReason,
    options?: { exceptSessionId?: string },
  ): Promise<void> {
    const filter: Record<string, unknown> = {
      userId: new ObjectId(userId),
      status: 'active',
    };
    if (options?.exceptSessionId && ObjectId.isValid(options.exceptSessionId)) {
      filter._id = { $ne: new ObjectId(options.exceptSessionId) };
    }

    await run(() =>
      this.sessions.updateMany(filter, {
        $set: { status: 'revoked', revokedAt: new Date(), revokedReason: reason },
      }),
    );
  }
}
