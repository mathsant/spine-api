import { describe, expect, it } from 'vitest';

import { finishReadingSessionSchema } from '../../../../src/schemas/reading-sessions';

describe('finishReadingSessionSchema', () => {
  it('accepts an empty body', () => {
    expect(finishReadingSessionSchema.parse({})).toEqual({ finishedAt: undefined });
  });

  it('accepts an ISO 8601 finishedAt', () => {
    const finishedAt = '2025-01-10T00:00:00.000Z';
    expect(finishReadingSessionSchema.parse({ finishedAt })).toEqual({ finishedAt });
  });

  it('rejects a non-ISO-8601 finishedAt', () => {
    expect(() => finishReadingSessionSchema.parse({ finishedAt: 'nope' })).toThrow();
  });
});
