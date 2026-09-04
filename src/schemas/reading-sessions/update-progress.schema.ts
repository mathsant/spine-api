import { z } from 'zod';

/**
 * Body of `POST /v1/reading-sessions/:sessionId/progress`
 * (contracts/books.openapi.yaml → updateReadingSessionProgress). No upper bound: the
 * page is not validated against the book's total page count (RF-013).
 */
export const updateProgressSchema = z.object({
  currentPage: z.number().int().min(1),
});

export type UpdateProgressInput = z.infer<typeof updateProgressSchema>;
