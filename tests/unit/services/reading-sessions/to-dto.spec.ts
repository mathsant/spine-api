import { describe, expect, it } from 'vitest';

import type { BookRecord } from '../../../../src/repositories/books';
import type { ReadingSessionRecord } from '../../../../src/repositories/reading-sessions';
import { toReadingSessionDTO, toReadingSessionListItemDTO } from '../../../../src/services/reading-sessions';

const session: ReadingSessionRecord = {
  id: '507f1f77bcf86cd799439011',
  userId: '507f1f77bcf86cd799439021',
  bookId: '507f1f77bcf86cd799439031',
  status: 'reading',
  startedAt: new Date('2026-01-01T00:00:00.000Z'),
  finishedAt: null,
  currentPage: 42,
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const book: BookRecord = {
  id: '507f1f77bcf86cd799439031',
  olid: 'OL1W',
  isbn13: null,
  title: 'Duna',
  authors: ['Frank Herbert'],
  coverUrl: 'https://covers/1.jpg',
  firstPublishYear: 1965,
  pageCount: 412,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('toReadingSessionDTO', () => {
  it('does not carry a book field', () => {
    expect(toReadingSessionDTO(session, null)).not.toHaveProperty('book');
  });
});

describe('toReadingSessionListItemDTO', () => {
  it('embeds a compact book summary alongside the session fields', () => {
    const dto = toReadingSessionListItemDTO(session, null, book);
    expect(dto.book).toEqual({
      olid: 'OL1W',
      title: 'Duna',
      authors: ['Frank Herbert'],
      coverUrl: 'https://covers/1.jpg',
      pageCount: 412,
    });
    expect(dto.id).toBe(session.id);
    expect(dto.review).toBeNull();
  });

  it('falls back to an empty summary when the book is missing', () => {
    const dto = toReadingSessionListItemDTO(session, null, undefined);
    expect(dto.book).toEqual({ olid: '', title: '', authors: [], coverUrl: null, pageCount: null });
  });
});
