import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  ACCESS_TOKEN_TTL_SECONDS,
  signAccessToken,
  verifyAccessToken,
} from '../../../src/auth/access-token';
import { InvalidAccessTokenError } from '../../../src/errors';

const SECRET = 'unit-test-secret-0123456789-abcdefghij';

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

describe('access-token', () => {
  it('exposes a 15-minute TTL', () => {
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(900);
  });

  it('round-trips: sign then verify returns the userId', () => {
    const now = 1_000_000;
    const token = signAccessToken({ userId: 'user-123' }, SECRET, now);

    expect(verifyAccessToken(token, SECRET, now + 10)).toEqual({ userId: 'user-123' });
  });

  it('rejects a token whose exp is in the past', () => {
    const now = 1_000_000;
    const token = signAccessToken({ userId: 'user-123' }, SECRET, now);

    expect(() => verifyAccessToken(token, SECRET, now + ACCESS_TOKEN_TTL_SECONDS + 1)).toThrow(
      InvalidAccessTokenError,
    );
  });

  it('rejects a token with a tampered payload (bad signature)', () => {
    const now = 1_000_000;
    const token = signAccessToken({ userId: 'user-123' }, SECRET, now);
    const [header, , signature] = token.split('.');
    const forgedPayload = b64url(JSON.stringify({ sub: 'attacker', iat: now, exp: now + 900 }));

    expect(() =>
      verifyAccessToken(`${header}.${forgedPayload}.${signature}`, SECRET, now),
    ).toThrow(InvalidAccessTokenError);
  });

  it('rejects a token verified with the wrong secret', () => {
    const now = 1_000_000;
    const token = signAccessToken({ userId: 'user-123' }, SECRET, now);

    expect(() => verifyAccessToken(token, 'a-different-secret-that-is-32+++chars', now)).toThrow(
      InvalidAccessTokenError,
    );
  });

  it('rejects any alg other than HS256, including "none"', () => {
    const now = 1_000_000;
    const payload = b64url(JSON.stringify({ sub: 'user-123', iat: now, exp: now + 900 }));

    const noneHeader = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    expect(() => verifyAccessToken(`${noneHeader}.${payload}.`, SECRET, now)).toThrow(
      InvalidAccessTokenError,
    );

    const hs512Header = b64url(JSON.stringify({ alg: 'HS512', typ: 'JWT' }));
    const hs512Sig = createHmac('sha512', SECRET)
      .update(`${hs512Header}.${payload}`)
      .digest('base64url');
    expect(() =>
      verifyAccessToken(`${hs512Header}.${payload}.${hs512Sig}`, SECRET, now),
    ).toThrow(InvalidAccessTokenError);
  });

  it('rejects a malformed token', () => {
    expect(() => verifyAccessToken('not.a.jwt', SECRET)).toThrow(InvalidAccessTokenError);
    expect(() => verifyAccessToken('only-one-segment', SECRET)).toThrow(InvalidAccessTokenError);
  });
});
