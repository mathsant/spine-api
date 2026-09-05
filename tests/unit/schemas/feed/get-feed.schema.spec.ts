import { describe, expect, it } from 'vitest';

import { getFeedSchema } from '../../../../src/schemas/feed';

describe('getFeedSchema', () => {
  it('defaults limit and allows an absent cursor', () => {
    expect(getFeedSchema.parse({})).toEqual({ cursor: undefined, limit: 20 });
  });

  it('accepts a cursor and a coerced limit', () => {
    expect(getFeedSchema.parse({ cursor: 'xyz', limit: '50' })).toEqual({ cursor: 'xyz', limit: 50 });
  });

  it('rejects limit above 100 or below 1', () => {
    expect(() => getFeedSchema.parse({ limit: '101' })).toThrow();
    expect(() => getFeedSchema.parse({ limit: '0' })).toThrow();
  });
});
