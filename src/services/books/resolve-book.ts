import { BookNotFoundError } from '../../errors';
import type { OpenLibraryClient } from '../../integrations/open-library';
import type { BookRecord, BookRepository } from '../../repositories/books';

export interface ResolveBookDeps {
  bookRepository: BookRepository;
  openLibraryClient: OpenLibraryClient;
}

/**
 * Shared cache-on-read step (RF-003): looks up the book in the local cache first, and
 * only calls Open Library — caching the result — on a miss. Used by every operation
 * that acts on a book by `olid` except removing a want-to-read mark (which never
 * calls Open Library — see `unmark-want-to-read.service.ts`).
 */
export async function resolveBook(
  { bookRepository, openLibraryClient }: ResolveBookDeps,
  olid: string,
): Promise<BookRecord> {
  const cached = await bookRepository.findByOlid(olid);
  if (cached) {
    return cached;
  }

  const found = await openLibraryClient.findByKey(olid);
  if (!found) {
    throw new BookNotFoundError();
  }
  return bookRepository.upsertByOlid(found);
}
