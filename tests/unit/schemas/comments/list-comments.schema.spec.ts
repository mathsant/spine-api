import { describe, expect, it } from 'vitest';

import { listCommentsSchema } from '../../../../src/schemas/comments';

describe('listCommentsSchema', () => {
  it('defaults limit to 20 when omitted', () => {
    expect(listCommentsSchema.parse({})).toEqual({ cursor: undefined, limit: 20 });
  });

  it('accepts cursor and limit', () => {
    expect(listCommentsSchema.parse({ cursor: 'abc', limit: '5' })).toEqual({ cursor: 'abc', limit: 5 });
  });

  it('rejects limit above 100', () => {
    expect(() => listCommentsSchema.parse({ limit: '101' })).toThrow();
  });

  it('rejects limit below 1', () => {
    expect(() => listCommentsSchema.parse({ limit: '0' })).toThrow();
  });
});
