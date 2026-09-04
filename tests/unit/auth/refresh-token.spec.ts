import { describe, expect, it } from 'vitest';

import {
  REFRESH_INACTIVITY_DAYS,
  generateRefreshToken,
  hashRefreshToken,
} from '../../../src/auth/refresh-token';

describe('refresh-token', () => {
  it('exposes a 30-day inactivity window', () => {
    expect(REFRESH_INACTIVITY_DAYS).toBe(30);
  });

  it('generates an opaque base64url token (32 bytes) with its sha256 hex hash', () => {
    const { token, tokenHash } = generateRefreshToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken(token)).toBe(tokenHash);
  });

  it('produces a different token on each call', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();

    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it('hashRefreshToken is stable', () => {
    expect(hashRefreshToken('some-token')).toBe(hashRefreshToken('some-token'));
  });
});
