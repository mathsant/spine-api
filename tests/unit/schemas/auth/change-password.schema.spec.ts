import { describe, expect, it } from 'vitest';

import { changePasswordSchema } from '../../../../src/schemas/auth';

describe('changePasswordSchema', () => {
  it('accepts current + new password, refreshToken optional', () => {
    expect(
      changePasswordSchema.parse({ currentPassword: 'old', newPassword: '12345678' }),
    ).toEqual({ currentPassword: 'old', newPassword: '12345678' });

    expect(
      changePasswordSchema.parse({
        currentPassword: 'old',
        newPassword: '12345678',
        refreshToken: 'tok',
      }).refreshToken,
    ).toBe('tok');
  });

  it('rejects a new password outside 8-72 chars', () => {
    expect(() =>
      changePasswordSchema.parse({ currentPassword: 'old', newPassword: '1234567' }),
    ).toThrow();
    expect(() =>
      changePasswordSchema.parse({ currentPassword: 'old', newPassword: '1'.repeat(73) }),
    ).toThrow();
  });

  it('rejects an empty currentPassword or an empty refreshToken when present', () => {
    expect(() =>
      changePasswordSchema.parse({ currentPassword: '', newPassword: '12345678' }),
    ).toThrow();
    expect(() =>
      changePasswordSchema.parse({
        currentPassword: 'old',
        newPassword: '12345678',
        refreshToken: '',
      }),
    ).toThrow();
  });
});
