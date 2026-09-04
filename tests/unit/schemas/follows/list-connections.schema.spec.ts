import { describe, expect, it } from 'vitest';

import { listConnectionsSchema } from '../../../../src/schemas/follows';

describe('listConnectionsSchema', () => {
  it('defaults limit and leaves cursor undefined when absent', () => {
    expect(listConnectionsSchema.parse({})).toEqual({ limit: 20 });
  });

  it('accepts a cursor and coerces limit', () => {
    expect(listConnectionsSchema.parse({ cursor: 'abc', limit: '10' })).toEqual({
      cursor: 'abc',
      limit: 10,
    });
  });

  it('rejects limit above 100 or below 1', () => {
    expect(() => listConnectionsSchema.parse({ limit: '101' })).toThrow();
    expect(() => listConnectionsSchema.parse({ limit: '0' })).toThrow();
  });

  it('rejects an empty cursor', () => {
    expect(() => listConnectionsSchema.parse({ cursor: '' })).toThrow();
  });
});
