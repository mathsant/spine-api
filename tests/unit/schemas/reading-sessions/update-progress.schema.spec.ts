import { describe, expect, it } from 'vitest';

import { updateProgressSchema } from '../../../../src/schemas/reading-sessions';

describe('updateProgressSchema', () => {
  it('accepts a positive integer currentPage', () => {
    expect(updateProgressSchema.parse({ currentPage: 120 })).toEqual({ currentPage: 120 });
  });

  it('rejects zero, negative or non-integer pages', () => {
    expect(() => updateProgressSchema.parse({ currentPage: 0 })).toThrow();
    expect(() => updateProgressSchema.parse({ currentPage: -5 })).toThrow();
    expect(() => updateProgressSchema.parse({ currentPage: 1.5 })).toThrow();
  });

  it('has no upper bound (RF-013 — no validation against total pages)', () => {
    expect(updateProgressSchema.parse({ currentPage: 999_999 })).toEqual({
      currentPage: 999_999,
    });
  });

  it('requires currentPage', () => {
    expect(() => updateProgressSchema.parse({})).toThrow();
  });
});
