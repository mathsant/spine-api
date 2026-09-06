import { z } from 'zod';

/**
 * Querystring of `GET /v1/me/reading-sessions` (contracts/books.openapi.yaml →
 * listReadingSessions).
 */
export const listReadingSessionsSchema = z.object({
  bookId: z.string().min(1).optional(),
  status: z.enum(['reading', 'finished']).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListReadingSessionsInput = z.infer<typeof listReadingSessionsSchema>;
