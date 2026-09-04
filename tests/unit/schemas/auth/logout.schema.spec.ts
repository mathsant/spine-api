import { describe, expect, it } from 'vitest';

import { logoutSchema } from '../../../../src/schemas/auth';

describe('logoutSchema', () => {
  it('accepts a non-empty refreshToken', () => {
    expect(logoutSchema.parse({ refreshToken: 'abc' })).toEqual({ refreshToken: 'abc' });
  });

  it('rejects an empty or missing refreshToken', () => {
    expect(() => logoutSchema.parse({ refreshToken: '' })).toThrow();
    expect(() => logoutSchema.parse({})).toThrow();
  });
});
