import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../../../src/auth/password';

describe('hashPassword / verifyPassword', () => {
  it('produces a scrypt-tagged, parameterised hash string', async () => {
    const stored = await hashPassword('correct horse battery staple');

    expect(stored).toMatch(/^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  });

  it('uses a per-hash salt, so the same password hashes differently each time', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');

    expect(a).not.toBe(b);
  });

  it('verifies the right password and rejects the wrong one', async () => {
    const stored = await hashPassword('s3cret-value');

    await expect(verifyPassword('s3cret-value', stored)).resolves.toBe(true);
    await expect(verifyPassword('not-it', stored)).resolves.toBe(false);
  });

  it('returns false (never throws) for a malformed stored value', async () => {
    await expect(verifyPassword('whatever', 'not-a-valid-hash')).resolves.toBe(false);
    await expect(verifyPassword('whatever', 'scrypt$16384$8$1$onlyfourfields')).resolves.toBe(
      false,
    );
  });
});
