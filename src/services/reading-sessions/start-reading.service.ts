import type { Clock } from '../../container/cradle';
import type { OpenLibraryClient } from '../../integrations/open-library';
import type { BookRepository } from '../../repositories/books';
import type { ReadingSessionRepository } from '../../repositories/reading-sessions';
import type { ShelfMembershipRepository } from '../../repositories/shelf-memberships';
import { resolveBook } from '../books';
import { toReadingSessionDTO } from './to-dto';
import type { ReadingSessionDTO } from './types';

export interface StartReadingInput {
  userId: string;
  olid: string;
}

export interface StartReadingResult {
  session: ReadingSessionDTO;
  /** true = a new session was created (201); false = an open one was reused (200) — RF-009. */
  created: boolean;
}

export type StartReading = (input: StartReadingInput) => Promise<StartReadingResult>;

export interface StartReadingDeps {
  bookRepository: BookRepository;
  openLibraryClient: OpenLibraryClient;
  readingSessionRepository: ReadingSessionRepository;
  shelfMembershipRepository: ShelfMembershipRepository;
  clock: Clock;
}

/**
 * Starts reading a book (RF-008), reusing an already-open session instead of
 * creating a duplicate (RF-009), and removing the book from want_to_read if present
 * (RF-010, best-effort — plan.md D7).
 */
export const makeStartReading =
  ({
    bookRepository,
    openLibraryClient,
    readingSessionRepository,
    shelfMembershipRepository,
    clock,
  }: StartReadingDeps): StartReading =>
  async ({ userId, olid }) => {
    const book = await resolveBook({ bookRepository, openLibraryClient }, olid);

    const existing = await readingSessionRepository.findOpenSession(userId, book.id);
    const record = await readingSessionRepository.startReading(userId, book.id, clock.now());
    await shelfMembershipRepository.remove(userId, book.id);

    return { session: toReadingSessionDTO(record), created: existing === null };
  };
