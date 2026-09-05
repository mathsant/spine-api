import { describe, expect, it } from 'vitest';

import type { NotificationRecord } from '../../../../src/repositories/notifications';
import { toNotificationDTO } from '../../../../src/services/notifications';

const base: NotificationRecord = {
  id: '507f1f77bcf86cd799439011',
  recipientId: '507f1f77bcf86cd799439021',
  type: 'follow_request',
  actorId: '507f1f77bcf86cd799439031',
  activityId: null,
  commentId: null,
  readingSessionId: null,
  activityType: null,
  readAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('toNotificationDTO', () => {
  it('exposes read: false when readAt is null', () => {
    expect(toNotificationDTO(base)).toEqual({
      id: base.id,
      type: 'follow_request',
      actorId: base.actorId,
      activityId: null,
      commentId: null,
      read: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('exposes read: true when readAt is set', () => {
    const read: NotificationRecord = { ...base, readAt: new Date('2026-01-02T00:00:00.000Z') };
    expect(toNotificationDTO(read).read).toBe(true);
  });

  it('carries activityId/commentId through for a comment-related notification', () => {
    const withRefs: NotificationRecord = {
      ...base,
      type: 'comment_on_content',
      activityId: '507f1f77bcf86cd799439041',
      commentId: '507f1f77bcf86cd799439051',
    };

    const dto = toNotificationDTO(withRefs);
    expect(dto.activityId).toBe('507f1f77bcf86cd799439041');
    expect(dto.commentId).toBe('507f1f77bcf86cd799439051');
  });
});
