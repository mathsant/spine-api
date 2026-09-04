import { describe, expect, it } from 'vitest';

import { editReviewSchema } from '../../../../src/schemas/reviews';

describe('editReviewSchema', () => {
  it('accepts rating alone', () => {
    expect(editReviewSchema.parse({ rating: 5 })).toEqual({
      rating: 5,
      text: undefined,
      containsSpoiler: undefined,
    });
  });

  it('accepts text set to null (clears it)', () => {
    expect(editReviewSchema.parse({ text: null })).toEqual({
      rating: undefined,
      text: null,
      containsSpoiler: undefined,
    });
  });

  it('accepts containsSpoiler alone', () => {
    expect(editReviewSchema.parse({ containsSpoiler: true })).toEqual({
      rating: undefined,
      text: undefined,
      containsSpoiler: true,
    });
  });

  it('rejects an empty body (at least one field required)', () => {
    expect(() => editReviewSchema.parse({})).toThrow();
  });

  it('rejects a rating outside 1-5', () => {
    expect(() => editReviewSchema.parse({ rating: 0 })).toThrow();
  });

  it('rejects text longer than 2000 characters', () => {
    expect(() => editReviewSchema.parse({ text: 'a'.repeat(2001) })).toThrow();
  });
});
