export type RevokedReason = 'logout' | 'reuse_detected' | 'password_changed' | 'expired';

/** A login session: groups the chain of rotated refresh-token links. */
export interface AuthSessionRecord {
  sessionId: string;
  userId: string;
  status: 'active' | 'revoked';
  createdAt: Date;
  lastUsedAt: Date;
  inactivityExpiresAt: Date;
  revokedReason?: RevokedReason;
}

/** One link in a session's refresh-token chain. `rotatedAt === null` ⇒ current link. */
export interface RefreshTokenRecord {
  id: string;
  sessionId: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  rotatedAt: Date | null;
  expiresAt: Date;
}

export interface CreateSessionInput {
  userId: string;
  refreshTokenHash: string;
  now: Date;
  inactivityExpiresAt: Date;
  refreshExpiresAt: Date;
}

export interface RotateInput {
  currentTokenId: string;
  sessionId: string;
  userId: string;
  newTokenHash: string;
  now: Date;
  inactivityExpiresAt: Date;
  refreshExpiresAt: Date;
}

/** Data-access port for `auth_sessions` + `refresh_tokens`. Only implementations touch the driver. */
export interface AuthSessionRepository {
  /** Creates an `active` session and its first refresh-token link (`rotatedAt: null`). */
  createSession(input: CreateSessionInput): Promise<{ sessionId: string }>;

  findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  findSessionById(sessionId: string): Promise<AuthSessionRecord | null>;

  /**
   * Atomic rotation: stamps `rotatedAt` on the current link only if it is still
   * `null`. On success inserts the new link and renews the session's inactivity
   * window, returning `{ rotated: true }`. If the link was already rotated (replay
   * or race) returns `{ rotated: false }` and changes nothing.
   */
  rotate(input: RotateInput): Promise<{ rotated: boolean }>;

  /** Marks a session `revoked` with a reason. Idempotent. */
  revokeSession(sessionId: string, reason: RevokedReason): Promise<void>;

  /** Revokes every `active` session of the user, optionally sparing one. */
  revokeAllUserSessions(
    userId: string,
    reason: RevokedReason,
    options?: { exceptSessionId?: string },
  ): Promise<void>;
}
