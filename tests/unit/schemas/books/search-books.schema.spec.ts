import { describe, expect, it } from 'vitest';

import { searchBooksSchema } from '../../../../src/schemas/books';

describe('searchBooksSchema', () => {
  it('accepts q alone and defaults page/limit', () => {
    expect(searchBooksSchema.parse({ q: 'duna' })).toEqual({ q: 'duna', page: 1, limit: 20 });
  });

  it('coerces page and limit from querystring strings', () => {
    expect(searchBooksSchema.parse({ q: 'duna', page: '2', limit: '10' })).toEqual({
      q: 'duna',
      page: 2,
      limit: 10,
    });
  });

  it('rejects an empty or missing q', () => {
    expect(() => searchBooksSchema.parse({ q: '' })).toThrow();
    expect(() => searchBooksSchema.parse({})).toThrow();
  });

  it('rejects q longer than 200 chars', () => {
    expect(() => searchBooksSchema.parse({ q: 'a'.repeat(201) })).toThrow();
  });

  it('rejects limit above 50 or below 1', () => {
    expect(() => searchBooksSchema.parse({ q: 'duna', limit: '51' })).toThrow();
    expect(() => searchBooksSchema.parse({ q: 'duna', limit: '0' })).toThrow();
  });

  it('rejects page below 1', () => {
    expect(() => searchBooksSchema.parse({ q: 'duna', page: '0' })).toThrow();
  });
});
