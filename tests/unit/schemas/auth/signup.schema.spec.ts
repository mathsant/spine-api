import { describe, expect, it } from 'vitest';

import { signupSchema } from '../../../../src/schemas/auth';

const valid = {
  email: 'alice@example.com',
  password: '12345678',
  handle: 'alice',
  displayName: 'Alice',
};

describe('signupSchema', () => {
  it('accepts a well-formed body', () => {
    expect(signupSchema.parse(valid)).toEqual(valid);
  });

  it('accepts a mixed-case handle (service lowercases it — D9)', () => {
    expect(signupSchema.parse({ ...valid, handle: 'Alice_01' }).handle).toBe('Alice_01');
  });

  it('trims displayName and rejects one that is blank after trimming', () => {
    expect(signupSchema.parse({ ...valid, displayName: '  Bob ' }).displayName).toBe('Bob');
    expect(() => signupSchema.parse({ ...valid, displayName: '   ' })).toThrow();
  });

  it('rejects a password shorter than 8 or longer than 72', () => {
    expect(() => signupSchema.parse({ ...valid, password: '1234567' })).toThrow();
    expect(signupSchema.parse({ ...valid, password: '1'.repeat(8) }).password).toHaveLength(8);
    expect(signupSchema.parse({ ...valid, password: '1'.repeat(72) }).password).toHaveLength(72);
    expect(() => signupSchema.parse({ ...valid, password: '1'.repeat(73) })).toThrow();
  });

  it('rejects handles outside 3-30 chars or with forbidden characters', () => {
    expect(() => signupSchema.parse({ ...valid, handle: 'ab' })).toThrow();
    expect(() => signupSchema.parse({ ...valid, handle: 'a'.repeat(31) })).toThrow();
    expect(() => signupSchema.parse({ ...valid, handle: 'has space' })).toThrow();
    expect(() => signupSchema.parse({ ...valid, handle: 'no-dash' })).toThrow();
  });

  it('rejects an invalid email', () => {
    expect(() => signupSchema.parse({ ...valid, email: 'nope' })).toThrow();
  });
});
