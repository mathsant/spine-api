import { describe, expect, it } from 'vitest';

import { editReadingSessionSchema } from '../../../../src/schemas/reading-sessions';

describe('editReadingSessionSchema', () => {
  it('accepts currentPage alone', () => {
    expect(editReadingSessionSchema.parse({ currentPage: 50 })).toEqual({
      startedAt: undefined,
      finishedAt: undefined,
      currentPage: 50,
    });
  });

  it('accepts startedAt and finishedAt together', () => {
    const startedAt = '2025-01-01T00:00:00.000Z';
    const finishedAt = '2025-02-01T00:00:00.000Z';
    expect(editReadingSessionSchema.parse({ startedAt, finishedAt })).toEqual({
      startedAt,
      finishedAt,
      currentPage: undefined,
    });
  });

  it('rejects an empty body (at least one field required)', () => {
    expect(() => editReadingSessionSchema.parse({})).toThrow();
  });

  it('rejects a non-positive currentPage', () => {
    expect(() => editReadingSessionSchema.parse({ currentPage: 0 })).toThrow();
  });

  it('rejects a non-ISO-8601 date', () => {
    expect(() => editReadingSessionSchema.parse({ startedAt: 'nope' })).toThrow();
  });
});
