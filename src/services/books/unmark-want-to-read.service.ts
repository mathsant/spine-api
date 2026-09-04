import type { BookRepository } from '../../repositories/books';
import type { ShelfMembershipRepository } from '../../repositories/shelf-memberships';

export interface UnmarkWantToReadInput {
  userId: string;
  olid: string;
}

export type UnmarkWantToRead = (input: UnmarkWantToReadInput) => Promise<void>;

export interface UnmarkWantToReadDeps {
  bookRepository: BookRepository;
  shelfMembershipRepository: ShelfMembershipRepository;
}

/**
 * Removes "want to read" (RF-006). Deliberately does **not** depend on
 * `OpenLibraryClient`: a book that was never cached can't have a membership either, so
 * this only ever looks at the local cache — never calls Open Library (D3).
 */
export const makeUnmarkWantToRead =
  ({ bookRepository, shelfMembershipRepository }: UnmarkWantToReadDeps): UnmarkWantToRead =>
  async ({ userId, olid }) => {
    const book = await bookRepository.findByOlid(olid);
    if (!book) {
      return;
    }
    await shelfMembershipRepository.remove(userId, book.id);
  };
