import { describe, expect, it } from 'vitest';

import { createReviewSchema } from '../../../../src/schemas/reviews';

describe('createReviewSchema', () => {
  it('accepts rating alone', () => {
    expect(createReviewSchema.parse({ rating: 4 })).toEqual({
      rating: 4,
      text: undefined,
      containsSpoiler: undefined,
    });
  });

  it('accepts rating, text and containsSpoiler together', () => {
    expect(createReviewSchema.parse({ rating: 5, text: 'Great book', containsSpoiler: true })).toEqual({
      rating: 5,
      text: 'Great book',
      containsSpoiler: true,
    });
  });

  it('rejects a missing rating', () => {
    expect(() => createReviewSchema.parse({})).toThrow();
  });

  it('rejects a rating outside 1-5', () => {
    expect(() => createReviewSchema.parse({ rating: 0 })).toThrow();
    expect(() => createReviewSchema.parse({ rating: 6 })).toThrow();
  });

  it('rejects a non-integer rating', () => {
    expect(() => createReviewSchema.parse({ rating: 4.5 })).toThrow();
  });

  it('rejects text longer than 2000 characters', () => {
    expect(() => createReviewSchema.parse({ rating: 3, text: 'a'.repeat(2001) })).toThrow();
  });
});
