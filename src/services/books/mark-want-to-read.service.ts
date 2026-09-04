import type { OpenLibraryClient } from '../../integrations/open-library';
import type { BookRepository } from '../../repositories/books';
import type { ShelfMembershipRepository } from '../../repositories/shelf-memberships';
import { resolveBook } from './resolve-book';

export interface MarkWantToReadInput {
  userId: string;
  olid: string;
}

export type MarkWantToRead = (input: MarkWantToReadInput) => Promise<void>;

export interface MarkWantToReadDeps {
  bookRepository: BookRepository;
  openLibraryClient: OpenLibraryClient;
  shelfMembershipRepository: ShelfMembershipRepository;
}

/** Marks "want to read" (RF-005), caching the book on first interaction (RF-003). */
export const makeMarkWantToRead =
  ({ bookRepository, openLibraryClient, shelfMembershipRepository }: MarkWantToReadDeps): MarkWantToRead =>
  async ({ userId, olid }) => {
    const book = await resolveBook({ bookRepository, openLibraryClient }, olid);
    await shelfMembershipRepository.add(userId, book.id);
  };
