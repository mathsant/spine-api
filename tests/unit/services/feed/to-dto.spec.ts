import { describe, expect, it } from 'vitest';

import type { ActivityRecord } from '../../../../src/repositories/activities';
import type { BookRecord } from '../../../../src/repositories/books';
import type { ReviewRecord } from '../../../../src/repositories/reviews';
import type { UserRecord } from '../../../../src/repositories/users';
import { toFeedItemDTO } from '../../../../src/services/feed';

const actor: UserRecord = {
  id: 'u1',
  email: 'a@example.com',
  passwordHash: 'x',
  handle: 'ana',
  displayName: 'Ana',
  bio: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const book: BookRecord = {
  id: 'b1',
  olid: 'OL1M',
  isbn13: null,
  title: 'Dune',
  authors: ['Frank Herbert'],
  coverUrl: null,
  firstPublishYear: 1965,
  pageCount: 412,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function activity(overrides: Partial<ActivityRecord>): ActivityRecord {
  return {
    id: 'a1',
    type: 'started_reading',
    actorId: 'u1',
    bookId: 'b1',
    readingSessionId: 's1',
    currentPage: null,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('toFeedItemDTO', () => {
  it('maps a started_reading item with zeroed reaction fields and no review', () => {
    const dto = toFeedItemDTO(activity({ type: 'started_reading' }), actor, book, null, 0, false);

    expect(dto).toMatchObject({
      id: 'a1',
      type: 'started_reading',
      currentPage: null,
      review: null,
      reactionsCount: 0,
      hasReacted: false,
      actor: { userId: 'u1', handle: 'ana', displayName: 'Ana' },
      book: {
        id: 'b1',
        title: 'Dune',
        authors: ['Frank Herbert'],
        coverUrl: null,
        firstPublishYear: 1965,
        pageCount: 412,
      },
    });
  });

  it('nulls firstPublishYear and pageCount when the book is missing', () => {
    const dto = toFeedItemDTO(activity({ type: 'started_reading' }), actor, undefined, null, 0, false);

    expect(dto.book).toMatchObject({ id: 'b1', firstPublishYear: null, pageCount: null });
  });

  it('embeds the live review only on a review_published item', () => {
    const review: ReviewRecord = {
      id: 'r1',
      userId: 'u1',
      sessionId: 's1',
      bookId: 'b1',
      rating: 5,
      text: 'Great',
      containsSpoiler: false,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-02T00:00:00.000Z'),
    };

    const published = toFeedItemDTO(
      activity({ type: 'review_published' }),
      actor,
      book,
      review,
      2,
      true,
    );
    expect(published.review).toMatchObject({ id: 'r1', rating: 5, text: 'Great' });
    expect(published.reactionsCount).toBe(2);
    expect(published.hasReacted).toBe(true);

    const notPublished = toFeedItemDTO(
      activity({ type: 'progress_update', currentPage: 42 }),
      actor,
      book,
      review,
      0,
      false,
    );
    expect(notPublished.review).toBeNull();
    expect(notPublished.currentPage).toBe(42);
  });
});
