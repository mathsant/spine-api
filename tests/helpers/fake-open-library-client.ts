import { OpenLibraryUnavailableError } from '../../src/errors';
import type {
  OpenLibraryClient,
  OpenLibrarySearchPage,
  OpenLibrarySearchResult,
} from '../../src/integrations/open-library';

/**
 * Deterministic in-memory double for `OpenLibraryClient` (plan.md D8). Used by
 * service integration tests so the database stays real (`mongodb-memory-server`)
 * while the Open Library network dependency is isolated.
 */
export class FakeOpenLibraryClient implements OpenLibraryClient {
  private readonly byOlid = new Map<string, OpenLibrarySearchResult>();
  private failing = false;

  /** Seeds a result so `findByKey`/`search` can resolve it. */
  seed(result: OpenLibrarySearchResult): void {
    this.byOlid.set(result.olid, result);
  }

  /** Makes every subsequent call throw `OpenLibraryUnavailableError`, simulating an outage. */
  simulateOutage(): void {
    this.failing = true;
  }

  async search(query: string, page: number, limit: number): Promise<OpenLibrarySearchPage> {
    if (this.failing) {
      throw new OpenLibraryUnavailableError();
    }

    const q = query.toLowerCase();
    const items = [...this.byOlid.values()].filter(
      (result) =>
        result.title.toLowerCase().includes(q) ||
        result.authors.some((author) => author.toLowerCase().includes(q)),
    );

    return { items, page, limit, totalItems: items.length };
  }

  async findByKey(olid: string): Promise<OpenLibrarySearchResult | null> {
    if (this.failing) {
      throw new OpenLibraryUnavailableError();
    }

    return this.byOlid.get(olid) ?? null;
  }
}

/** A ready-to-use OpenLibrarySearchResult for tests that don't care about the exact fields. */
export function aSearchResult(overrides: Partial<OpenLibrarySearchResult> = {}): OpenLibrarySearchResult {
  return {
    olid: 'OL12345W',
    isbn13: '9780441013593',
    title: 'Duna',
    authors: ['Frank Herbert'],
    coverUrl: 'https://covers.openlibrary.org/b/id/999-M.jpg',
    firstPublishYear: 1965,
    pageCount: 412,
    ...overrides,
  };
}
