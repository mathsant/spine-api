import { describe, expect, it } from 'vitest';

import type { CommentRecord } from '../../../../src/repositories/comments';
import { toCommentDTO } from '../../../../src/services/comments';

const base: CommentRecord = {
  id: '507f1f77bcf86cd799439011',
  activityId: '507f1f77bcf86cd799439021',
  readingSessionId: '507f1f77bcf86cd799439031',
  activityType: 'progress_update',
  authorId: '507f1f77bcf86cd799439041',
  text: 'Original text',
  parentCommentId: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('toCommentDTO', () => {
  it('exposes the persisted text and deleted: false when not deleted', () => {
    expect(toCommentDTO(base)).toEqual({
      id: base.id,
      activityId: base.activityId,
      authorId: base.authorId,
      text: 'Original text',
      parentCommentId: null,
      deleted: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('replaces the text with the placeholder and deleted: true after a soft delete', () => {
    const deleted: CommentRecord = { ...base, deletedAt: new Date('2026-01-02T00:00:00.000Z') };

    const dto = toCommentDTO(deleted);
    expect(dto.text).toBe('[removido]');
    expect(dto.deleted).toBe(true);
  });

  it('carries parentCommentId through for a reply', () => {
    const reply: CommentRecord = { ...base, parentCommentId: '507f1f77bcf86cd799439099' };

    expect(toCommentDTO(reply).parentCommentId).toBe('507f1f77bcf86cd799439099');
  });
});
