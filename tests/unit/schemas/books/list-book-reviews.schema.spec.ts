import { describe, expect, it } from 'vitest';

import { listBookReviewsSchema } from '../../../../src/schemas/books';

describe('listBookReviewsSchema', () => {
  it('defaults limit and allows an absent cursor', () => {
    expect(listBookReviewsSchema.parse({})).toEqual({ cursor: undefined, limit: 20 });
  });

  it('accepts a cursor and a coerced limit', () => {
    expect(listBookReviewsSchema.parse({ cursor: 'abc', limit: '30' })).toEqual({
      cursor: 'abc',
      limit: 30,
    });
  });

  it('rejects an empty cursor and a limit outside 1..50', () => {
    expect(() => listBookReviewsSchema.parse({ cursor: '' })).toThrow();
    expect(() => listBookReviewsSchema.parse({ limit: '51' })).toThrow();
    expect(() => listBookReviewsSchema.parse({ limit: '0' })).toThrow();
  });
});
