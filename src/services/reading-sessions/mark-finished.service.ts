import type { OpenLibraryClient } from '../../integrations/open-library';
import type { BookRepository } from '../../repositories/books';
import type { ReadingSessionRepository } from '../../repositories/reading-sessions';
import type { ShelfMembershipRepository } from '../../repositories/shelf-memberships';
import { resolveBook } from '../books';
import { toReadingSessionDTO } from './to-dto';
import type { ReadingSessionDTO } from './types';

export interface MarkFinishedInput {
  userId: string;
  olid: string;
  startedAt?: Date;
  finishedAt: Date;
}

export type MarkFinished = (input: MarkFinishedInput) => Promise<ReadingSessionDTO>;

export interface MarkFinishedDeps {
  bookRepository: BookRepository;
  openLibraryClient: OpenLibraryClient;
  readingSessionRepository: ReadingSessionRepository;
  shelfMembershipRepository: ShelfMembershipRepository;
}

/**
 * Marks a book as read directly, without an existing `reading` session (RF-014).
 * Always creates a new session — rereading a book already marked finished creates
 * another, independent one (RF-016). Removes want_to_read if present (RF-010,
 * best-effort — plan.md D7).
 */
export const makeMarkFinished =
  ({ bookRepository, openLibraryClient, readingSessionRepository, shelfMembershipRepository }: MarkFinishedDeps): MarkFinished =>
  async ({ userId, olid, startedAt, finishedAt }) => {
    const book = await resolveBook({ bookRepository, openLibraryClient }, olid);

    const record = await readingSessionRepository.createFinished(userId, book.id, {
      startedAt: startedAt ?? null,
      finishedAt,
    });
    await shelfMembershipRepository.remove(userId, book.id);

    return toReadingSessionDTO(record);
  };
