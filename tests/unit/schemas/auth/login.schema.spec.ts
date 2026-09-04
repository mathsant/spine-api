import { describe, expect, it } from 'vitest';

import { loginSchema } from '../../../../src/schemas/auth';

describe('loginSchema', () => {
  it('accepts email + non-empty password', () => {
    expect(loginSchema.parse({ email: 'a@b.com', password: 'x' })).toEqual({
      email: 'a@b.com',
      password: 'x',
    });
  });

  it('rejects an invalid email', () => {
    expect(() => loginSchema.parse({ email: 'nope', password: 'x' })).toThrow();
  });

  it('rejects an empty password', () => {
    expect(() => loginSchema.parse({ email: 'a@b.com', password: '' })).toThrow();
  });

  it('rejects unknown / missing fields', () => {
    expect(() => loginSchema.parse({ email: 'a@b.com' })).toThrow();
  });
});
