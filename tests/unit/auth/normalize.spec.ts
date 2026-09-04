import { describe, expect, it } from 'vitest';

import { normalizeEmail, normalizeHandle } from '../../../src/auth/normalize';

describe('normalizeEmail', () => {
  it('trims surrounding whitespace and lowercases', () => {
    expect(normalizeEmail('  Alice@Example.COM ')).toBe('alice@example.com');
  });

  it('is idempotent', () => {
    const once = normalizeEmail('  Bob@B.com ');
    expect(normalizeEmail(once)).toBe(once);
  });
});

describe('normalizeHandle', () => {
  it('lowercases', () => {
    expect(normalizeHandle('Alice_01')).toBe('alice_01');
  });

  it('is idempotent', () => {
    expect(normalizeHandle(normalizeHandle('ALICE'))).toBe('alice');
  });
});
