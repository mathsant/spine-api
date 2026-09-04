import { describe, expect, it } from 'vitest';

import { refreshSchema } from '../../../../src/schemas/auth';

describe('refreshSchema', () => {
  it('accepts a non-empty refreshToken', () => {
    expect(refreshSchema.parse({ refreshToken: 'abc' })).toEqual({ refreshToken: 'abc' });
  });

  it('rejects an empty or missing refreshToken', () => {
    expect(() => refreshSchema.parse({ refreshToken: '' })).toThrow();
    expect(() => refreshSchema.parse({})).toThrow();
  });
});
