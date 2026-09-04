import type { OpenLibraryClient } from '../../integrations/open-library';
import type { BookSearchPageDTO } from './types';

export interface SearchBooksInput {
  q: string;
  page: number;
  limit: number;
}

export type SearchBooks = (input: SearchBooksInput) => Promise<BookSearchPageDTO>;

export interface SearchBooksDeps {
  openLibraryClient: OpenLibraryClient;
}

/** Free-text book search proxied to Open Library (RF-001, RF-002). */
export const makeSearchBooks =
  ({ openLibraryClient }: SearchBooksDeps): SearchBooks =>
  async ({ q, page, limit }) =>
    openLibraryClient.search(q, page, limit);
