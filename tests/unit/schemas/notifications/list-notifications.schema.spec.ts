import { describe, expect, it } from 'vitest';

import { listNotificationsSchema } from '../../../../src/schemas/notifications';

describe('listNotificationsSchema', () => {
  it('defaults limit to 20 when omitted', () => {
    expect(listNotificationsSchema.parse({})).toEqual({ cursor: undefined, limit: 20 });
  });

  it('accepts cursor and limit', () => {
    expect(listNotificationsSchema.parse({ cursor: 'abc', limit: '5' })).toEqual({ cursor: 'abc', limit: 5 });
  });

  it('rejects limit above 100', () => {
    expect(() => listNotificationsSchema.parse({ limit: '101' })).toThrow();
  });

  it('rejects limit below 1', () => {
    expect(() => listNotificationsSchema.parse({ limit: '0' })).toThrow();
  });
});
