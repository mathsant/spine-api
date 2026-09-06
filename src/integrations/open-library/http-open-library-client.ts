import { OpenLibraryUnavailableError } from '../../errors';
import type {
  OpenLibraryClient,
  OpenLibrarySearchPage,
  OpenLibrarySearchResult,
} from './open-library-client';

export interface HttpOpenLibraryClientOptions {
  baseUrl: string;
  timeoutMs: number;
}

interface OpenLibraryDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  number_of_pages_median?: number;
  isbn?: string[];
}

interface OpenLibrarySearchResponse {
  numFound: number;
  docs: OpenLibraryDoc[];
}

const WORKS_KEY_PREFIX = '/works/';

function toResult(doc: OpenLibraryDoc): OpenLibrarySearchResult {
  const isbn13 = doc.isbn?.find((code) => code.length === 13) ?? null;

  return {
    olid: (doc.key ?? '').replace(WORKS_KEY_PREFIX, ''),
    isbn13,
    title: doc.title ?? '',
    authors: doc.author_name ?? [],
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    firstPublishYear: doc.first_publish_year ?? null,
    pageCount: doc.number_of_pages_median ?? null,
  };
}

/**
 * `OpenLibraryClient` backed by `fetch` against the real Open Library search API
 * (plan.md D1, D2). The only method of reaching Open Library used by this feature.
 */
export class HttpOpenLibraryClient implements OpenLibraryClient {
  constructor(private readonly options: HttpOpenLibraryClientOptions) {}

  async search(query: string, page: number, limit: number): Promise<OpenLibrarySearchPage> {
    const url = new URL('/search.json', this.options.baseUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(limit));

    const response = await this.fetchJson(url);

    return {
      items: response.docs.map(toResult),
      page,
      limit,
      totalItems: response.numFound,
    };
  }

  async findByKey(olid: string): Promise<OpenLibrarySearchResult | null> {
    const url = new URL('/search.json', this.options.baseUrl);
    url.searchParams.set('q', `key:${WORKS_KEY_PREFIX}${olid}`);
    url.searchParams.set('limit', '1');

    const response = await this.fetchJson(url);
    return response.docs.length > 0 ? toResult(response.docs[0]) : null;
  }

  private async fetchJson(url: URL): Promise<OpenLibrarySearchResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new OpenLibraryUnavailableError();
      }
      return (await response.json()) as OpenLibrarySearchResponse;
    } catch (error) {
      if (error instanceof OpenLibraryUnavailableError) {
        throw error;
      }
      throw new OpenLibraryUnavailableError();
    } finally {
      clearTimeout(timeout);
    }
  }
}
