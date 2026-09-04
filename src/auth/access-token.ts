import { createHmac, timingSafeEqual } from 'node:crypto';

import { InvalidAccessTokenError } from '../errors';

/** Access token time-to-live: 15 minutes (RF-017). Fixed by the spec, not configurable. */
export const ACCESS_TOKEN_TTL_SECONDS = 900;

export interface AccessTokenClaims {
  userId: string;
}

interface JwtHeader {
  alg: string;
  typ?: string;
}

interface JwtPayload {
  sub?: unknown;
  iat?: unknown;
  exp?: unknown;
}

const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

function sign(signingInput: string, secret: string): string {
  return createHmac('sha256', secret).update(signingInput).digest('base64url');
}

function nowInSeconds(explicit?: number): number {
  return explicit ?? Math.floor(Date.now() / 1000);
}

/** Sign a compact HS256 JWT: `{ sub, iat, exp }`, `exp = iat + ACCESS_TOKEN_TTL_SECONDS`. */
export function signAccessToken(
  claims: AccessTokenClaims,
  secret: string,
  nowSeconds?: number,
): string {
  const iat = nowInSeconds(nowSeconds);
  const payload = Buffer.from(
    JSON.stringify({ sub: claims.userId, iat, exp: iat + ACCESS_TOKEN_TTL_SECONDS }),
  ).toString('base64url');
  const signingInput = `${HEADER}.${payload}`;
  return `${signingInput}.${sign(signingInput, secret)}`;
}

/**
 * Verify a compact HS256 JWT. Rejects (with {@link InvalidAccessTokenError}) any of:
 * malformed token, `alg` other than `HS256` (including `none`), bad signature,
 * missing `sub`, or `exp` at/after now.
 */
export function verifyAccessToken(
  token: string,
  secret: string,
  nowSeconds?: number,
): AccessTokenClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new InvalidAccessTokenError();
  }
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: JwtHeader;
  let payload: JwtPayload;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as JwtHeader;
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as JwtPayload;
  } catch {
    throw new InvalidAccessTokenError();
  }

  if (header.alg !== 'HS256') {
    throw new InvalidAccessTokenError();
  }

  const expected = Buffer.from(sign(`${headerB64}.${payloadB64}`, secret), 'utf8');
  const provided = Buffer.from(signatureB64, 'utf8');
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new InvalidAccessTokenError();
  }

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new InvalidAccessTokenError();
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowInSeconds(nowSeconds)) {
    throw new InvalidAccessTokenError();
  }

  return { userId: payload.sub };
}
