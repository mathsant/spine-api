import { describe, expect, it } from 'vitest';

import { searchUsersSchema } from '../../../../src/schemas/users';

describe('searchUsersSchema', () => {
  it('accepts q alone and defaults page/limit', () => {
    expect(searchUsersSchema.parse({ q: 'bob' })).toEqual({ q: 'bob', page: 1, limit: 20 });
  });

  it('coerces page and limit from querystring strings', () => {
    expect(searchUsersSchema.parse({ q: 'bob', page: '2', limit: '10' })).toEqual({
      q: 'bob',
      page: 2,
      limit: 10,
    });
  });

  it('trims q', () => {
    expect(searchUsersSchema.parse({ q: '  bob  ' })).toEqual({ q: 'bob', page: 1, limit: 20 });
  });

  it('rejects q shorter than 2 chars or missing', () => {
    expect(() => searchUsersSchema.parse({ q: 'b' })).toThrow();
    expect(() => searchUsersSchema.parse({})).toThrow();
  });

  it('rejects q longer than 100 chars', () => {
    expect(() => searchUsersSchema.parse({ q: 'a'.repeat(101) })).toThrow();
  });

  it('rejects limit above 50 or below 1', () => {
    expect(() => searchUsersSchema.parse({ q: 'bob', limit: '51' })).toThrow();
    expect(() => searchUsersSchema.parse({ q: 'bob', limit: '0' })).toThrow();
  });

  it('rejects page below 1', () => {
    expect(() => searchUsersSchema.parse({ q: 'bob', page: '0' })).toThrow();
  });
});
