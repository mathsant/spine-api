import { describe, expect, it } from 'vitest';

import { listWantToReadSchema } from '../../../../src/schemas/books';

describe('listWantToReadSchema', () => {
  it('defaults limit and allows an absent cursor', () => {
    expect(listWantToReadSchema.parse({})).toEqual({ cursor: undefined, limit: 20 });
  });

  it('accepts a cursor and a coerced limit', () => {
    expect(listWantToReadSchema.parse({ cursor: 'abc', limit: '50' })).toEqual({
      cursor: 'abc',
      limit: 50,
    });
  });

  it('rejects limit above 100 or below 1', () => {
    expect(() => listWantToReadSchema.parse({ limit: '101' })).toThrow();
    expect(() => listWantToReadSchema.parse({ limit: '0' })).toThrow();
  });
});
