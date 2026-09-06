import { describe, expect, it } from 'vitest';

import { listUserActivitySchema } from '../../../../src/schemas/users';

describe('listUserActivitySchema', () => {
  it('defaults limit and allows an absent cursor', () => {
    expect(listUserActivitySchema.parse({})).toEqual({ cursor: undefined, limit: 20 });
  });

  it('accepts a cursor and a coerced limit', () => {
    expect(listUserActivitySchema.parse({ cursor: 'abc', limit: '50' })).toEqual({
      cursor: 'abc',
      limit: 50,
    });
  });

  it('rejects an empty cursor and a limit outside 1..100', () => {
    expect(() => listUserActivitySchema.parse({ cursor: '' })).toThrow();
    expect(() => listUserActivitySchema.parse({ limit: '101' })).toThrow();
    expect(() => listUserActivitySchema.parse({ limit: '0' })).toThrow();
  });
});
