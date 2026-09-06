import { describe, expect, it } from 'vitest';

import { listReadingSessionsSchema } from '../../../../src/schemas/reading-sessions';

describe('listReadingSessionsSchema', () => {
  it('defaults limit and allows absent bookId/status/cursor', () => {
    expect(listReadingSessionsSchema.parse({})).toEqual({
      bookId: undefined,
      status: undefined,
      cursor: undefined,
      limit: 20,
    });
  });

  it('accepts bookId, status, cursor and a coerced limit', () => {
    expect(
      listReadingSessionsSchema.parse({
        bookId: 'abc123',
        status: 'reading',
        cursor: 'xyz',
        limit: '50',
      }),
    ).toEqual({ bookId: 'abc123', status: 'reading', cursor: 'xyz', limit: 50 });
  });

  it('accepts status finished and rejects any other status value', () => {
    expect(listReadingSessionsSchema.parse({ status: 'finished' }).status).toBe('finished');
    expect(() => listReadingSessionsSchema.parse({ status: 'abandoned' })).toThrow();
  });

  it('rejects limit above 100 or below 1', () => {
    expect(() => listReadingSessionsSchema.parse({ limit: '101' })).toThrow();
    expect(() => listReadingSessionsSchema.parse({ limit: '0' })).toThrow();
  });
});
