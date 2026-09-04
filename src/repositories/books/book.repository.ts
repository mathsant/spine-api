/** Persisted shape of a cached Book, with the Mongo `_id` surfaced as a hex string `id`. */
export interface BookRecord {
  id: string;
  olid: string;
  isbn13: string | null;
  title: string;
  authors: string[];
  coverUrl: string | null;
  firstPublishYear: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Fields to upsert into the cache, sourced from an Open Library search result. */
export interface UpsertBookInput {
  olid: string;
  isbn13: string | null;
  title: string;
  authors: string[];
  coverUrl: string | null;
  firstPublishYear: number | null;
}

/** Data-access port for the `books` collection. Only implementations touch the driver. */
export interface BookRepository {
  findByOlid(olid: string): Promise<BookRecord | null>;
  findById(id: string): Promise<BookRecord | null>;
  /** Creates on the first call for an `olid`; updates (never duplicates) afterwards. */
  upsertByOlid(input: UpsertBookInput): Promise<BookRecord>;
}
