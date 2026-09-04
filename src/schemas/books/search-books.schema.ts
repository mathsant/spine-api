import { z } from 'zod';

/** Querystring of `GET /v1/books/search` (contracts/books.openapi.yaml → searchBooks). */
export const searchBooksSchema = z.object({
  q: z.string().trim().min(1).max(200),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchBooksInput = z.infer<typeof searchBooksSchema>;
