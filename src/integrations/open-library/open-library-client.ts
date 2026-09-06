/** One search result document from the Open Library search API, mapped to our shape. */
export interface OpenLibrarySearchResult {
  /** Open Library work key without the `/works/` prefix (e.g. `OL12345W`). */
  olid: string;
  isbn13: string | null;
  title: string;
  authors: string[];
  /** Resolved from `cover_i`, e.g. `https://covers.openlibrary.org/b/id/<cover_i>-M.jpg`. */
  coverUrl: string | null;
  firstPublishYear: number | null;
  /** From Open Library's `number_of_pages_median` (work-level median). `null` when absent. */
  pageCount: number | null;
}

export interface OpenLibrarySearchPage {
  items: OpenLibrarySearchResult[];
  page: number;
  limit: number;
  totalItems: number;
}

/**
 * Port for the Open Library integration (see plan.md D1, D2, D8). The only place
 * outside this port that may know about Open Library's HTTP shape is
 * `http-open-library-client.ts`; everything else depends on this interface.
 */
export interface OpenLibraryClient {
  /**
   * Free-text search by title/author. Throws `OpenLibraryUnavailableError` on
   * network error, timeout or a 5xx response. Zero matches is a valid empty page,
   * not an error.
   */
  search(query: string, page: number, limit: number): Promise<OpenLibrarySearchPage>;

  /**
   * Exact lookup by `olid`. `null` when there is no matching work (not an error).
   * Throws `OpenLibraryUnavailableError` on network error, timeout or a 5xx response.
   */
  findByKey(olid: string): Promise<OpenLibrarySearchResult | null>;
}
