import { describe, expect, it } from 'vitest';

import { editProfileSchema } from '../../../../src/schemas/profile';

describe('editProfileSchema', () => {
  it('accepts displayName alone', () => {
    expect(editProfileSchema.parse({ displayName: 'Alice Reader' })).toEqual({
      displayName: 'Alice Reader',
    });
  });

  it('accepts bio alone, including null to clear it', () => {
    expect(editProfileSchema.parse({ bio: 'Reading sci-fi' })).toEqual({ bio: 'Reading sci-fi' });
    expect(editProfileSchema.parse({ bio: null })).toEqual({ bio: null });
  });

  it('accepts both fields together', () => {
    expect(editProfileSchema.parse({ displayName: 'Alice', bio: 'Hi' })).toEqual({
      displayName: 'Alice',
      bio: 'Hi',
    });
  });

  it('trims displayName and bio', () => {
    expect(editProfileSchema.parse({ displayName: '  Alice  ', bio: '  hi  ' })).toEqual({
      displayName: 'Alice',
      bio: 'hi',
    });
  });

  it('rejects an empty body (no field present)', () => {
    expect(() => editProfileSchema.parse({})).toThrow();
  });

  it('rejects an empty displayName', () => {
    expect(() => editProfileSchema.parse({ displayName: '' })).toThrow();
  });

  it('rejects displayName longer than 50 chars', () => {
    expect(() => editProfileSchema.parse({ displayName: 'a'.repeat(51) })).toThrow();
  });

  it('rejects bio longer than 280 chars', () => {
    expect(() => editProfileSchema.parse({ bio: 'a'.repeat(281) })).toThrow();
  });

  it('rejects a handle field (not part of the schema)', () => {
    expect(editProfileSchema.parse({ displayName: 'Alice', handle: 'new-handle' })).not.toHaveProperty(
      'handle',
    );
  });
});
