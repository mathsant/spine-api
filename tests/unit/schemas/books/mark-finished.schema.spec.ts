import { describe, expect, it } from 'vitest';

import { markFinishedSchema } from '../../../../src/schemas/books';

describe('markFinishedSchema', () => {
  it('accepts finishedAt alone', () => {
    const finishedAt = '2025-01-10T00:00:00.000Z';
    expect(markFinishedSchema.parse({ finishedAt })).toEqual({
      startedAt: undefined,
      finishedAt,
    });
  });

  it('accepts an optional startedAt', () => {
    const startedAt = '2024-12-01T00:00:00.000Z';
    const finishedAt = '2025-01-10T00:00:00.000Z';
    expect(markFinishedSchema.parse({ startedAt, finishedAt })).toEqual({ startedAt, finishedAt });
  });

  it('requires finishedAt', () => {
    expect(() => markFinishedSchema.parse({})).toThrow();
  });

  it('rejects a non-ISO-8601 date', () => {
    expect(() => markFinishedSchema.parse({ finishedAt: 'not-a-date' })).toThrow();
    expect(() =>
      markFinishedSchema.parse({ finishedAt: '2025-01-10', startedAt: 'nope' }),
    ).toThrow();
  });
});
