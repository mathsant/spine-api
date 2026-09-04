import { describe, expect, it } from 'vitest';

import { decodeCursor, encodeCursor } from '../../../src/lib/pagination';

describe('pagination cursor', () => {
  it('round-trips a payload through encode/decode', () => {
    const payload = { createdAt: '2025-01-10T00:00:00.000Z', id: '507f1f77bcf86cd799439011' };
    expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
  });

  it('produces a base64url string (no +, /, or = padding)', () => {
    const cursor = encodeCursor({ createdAt: '2025-01-10T00:00:00.000Z', id: 'a'.repeat(24) });
    expect(cursor).not.toMatch(/[+/=]/);
  });

  it('throws on a malformed cursor', () => {
    expect(() => decodeCursor('not-base64url!!!')).toThrow();
  });

  it('throws when the decoded JSON is missing required fields', () => {
    const bogus = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64url');
    expect(() => decodeCursor(bogus)).toThrow();
  });
});
