import { createHash, randomBytes } from 'node:crypto';

/** Refresh session inactivity window: 30 days (RF-025). Fixed by the spec. */
export const REFRESH_INACTIVITY_DAYS = 30;

const TOKEN_BYTES = 32;

/** sha256 hex of a raw refresh token — the only form persisted (RF-022). */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * A new opaque refresh token (256 bits of entropy, base64url) plus its hash.
 * The raw `token` goes to the client and is never stored.
 */
export function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashRefreshToken(token) };
}
