import { describe, expect, it } from 'vitest';

import { listFollowRequestsSchema } from '../../../../src/schemas/follows';

describe('listFollowRequestsSchema', () => {
  it('defaults direction to incoming and limit to 20', () => {
    expect(listFollowRequestsSchema.parse({})).toEqual({ direction: 'incoming', limit: 20 });
  });

  it('accepts direction outgoing', () => {
    expect(listFollowRequestsSchema.parse({ direction: 'outgoing' })).toEqual({
      direction: 'outgoing',
      limit: 20,
    });
  });

  it('accepts a cursor and coerces limit', () => {
    expect(listFollowRequestsSchema.parse({ cursor: 'abc', limit: '10' })).toEqual({
      direction: 'incoming',
      cursor: 'abc',
      limit: 10,
    });
  });

  it('rejects an invalid direction', () => {
    expect(() => listFollowRequestsSchema.parse({ direction: 'sideways' })).toThrow();
  });

  it('rejects limit above 100 or below 1', () => {
    expect(() => listFollowRequestsSchema.parse({ limit: '101' })).toThrow();
    expect(() => listFollowRequestsSchema.parse({ limit: '0' })).toThrow();
  });
});
