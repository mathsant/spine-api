import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../../src/errors';
import {
  decodeReadingSessionCursor,
  encodeReadingSessionCursor,
} from '../../../src/lib/reading-session-cursor';

describe('reading-session cursor', () => {
  it('round-trips a payload through encode/decode', () => {
    const payload = {
      status: 'reading' as const,
      createdAt: '2025-01-10T00:00:00.000Z',
      id: '507f1f77bcf86cd799439011',
    };
    expect(decodeReadingSessionCursor(encodeReadingSessionCursor(payload))).toEqual(payload);
  });

  it('produces a base64url string (no +, /, or = padding)', () => {
    const cursor = encodeReadingSessionCursor({
      status: 'finished',
      createdAt: '2025-01-10T00:00:00.000Z',
      id: 'a'.repeat(24),
    });
    expect(cursor).not.toMatch(/[+/=]/);
  });

  it('rejects a malformed cursor with ValidationError', () => {
    expect(() => decodeReadingSessionCursor('not-base64url!!!')).toThrow(ValidationError);
  });

  it('rejects a cursor in the previous format (no status field)', () => {
    const legacy = Buffer.from(
      JSON.stringify({ createdAt: '2025-01-10T00:00:00.000Z', id: 'a'.repeat(24) }),
    ).toString('base64url');
    expect(() => decodeReadingSessionCursor(legacy)).toThrow(ValidationError);
  });

  it('rejects a cursor with an unknown status value', () => {
    const bogus = Buffer.from(
      JSON.stringify({ status: 'abandoned', createdAt: '2025-01-10T00:00:00.000Z', id: 'x'.repeat(24) }),
    ).toString('base64url');
    expect(() => decodeReadingSessionCursor(bogus)).toThrow(ValidationError);
  });
});
