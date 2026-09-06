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

  it('carries pageCount through each item (value and null)', async () => {
    const openLibraryClient = new FakeOpenLibraryClient();
    openLibraryClient.seed(aSearchResult({ olid: 'OL_PAGES_W', title: 'com paginas', pageCount: 320 }));
    openLibraryClient.seed(aSearchResult({ olid: 'OL_NO_PAGES_W', title: 'sem paginas', pageCount: null }));
    const searchBooks = makeSearchBooks({ openLibraryClient });

    const withPages = await searchBooks({ q: 'com paginas', page: 1, limit: 20 });
    const withoutPages = await searchBooks({ q: 'sem paginas', page: 1, limit: 20 });

    expect(withPages.items[0].pageCount).toBe(320);
    expect(withoutPages.items[0].pageCount).toBeNull();
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
