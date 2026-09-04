import { describe, expect, it } from 'vitest';

import { OpenLibraryUnavailableError } from '../../../../src/errors';
import { makeSearchBooks } from '../../../../src/services/books';
import { aSearchResult, FakeOpenLibraryClient } from '../../../helpers/fake-open-library-client';

describe('search-books service (integration)', () => {
  it('delegates to the client and returns a BookSearchPageDTO', async () => {
    const openLibraryClient = new FakeOpenLibraryClient();
    openLibraryClient.seed(aSearchResult());
    const searchBooks = makeSearchBooks({ openLibraryClient });

    const page = await searchBooks({ q: 'duna', page: 1, limit: 20 });

    expect(page).toEqual({
      items: [aSearchResult()],
      page: 1,
      limit: 20,
      totalItems: 1,
    });
  });

  it('propagates OpenLibraryUnavailableError from the client', async () => {
    const openLibraryClient = new FakeOpenLibraryClient();
    openLibraryClient.simulateOutage();
    const searchBooks = makeSearchBooks({ openLibraryClient });

    await expect(searchBooks({ q: 'duna', page: 1, limit: 20 })).rejects.toBeInstanceOf(
      OpenLibraryUnavailableError,
    );
  });
});
