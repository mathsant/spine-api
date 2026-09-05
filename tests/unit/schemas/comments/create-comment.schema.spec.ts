import { describe, expect, it } from 'vitest';

import { createCommentSchema } from '../../../../src/schemas/comments';

describe('createCommentSchema', () => {
  it('accepts text alone (top-level comment)', () => {
    expect(createCommentSchema.parse({ text: 'Nice!' })).toEqual({
      text: 'Nice!',
      parentCommentId: undefined,
    });
  });

  it('accepts text with parentCommentId (a reply)', () => {
    expect(createCommentSchema.parse({ text: 'Thanks!', parentCommentId: '507f1f77bcf86cd799439011' })).toEqual({
      text: 'Thanks!',
      parentCommentId: '507f1f77bcf86cd799439011',
    });
  });

  it('rejects a missing text', () => {
    expect(() => createCommentSchema.parse({})).toThrow();
  });

  it('rejects an empty text (RF-006)', () => {
    expect(() => createCommentSchema.parse({ text: '' })).toThrow();
  });
});
