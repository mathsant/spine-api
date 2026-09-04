import { z } from 'zod';

/**
 * Body of `PATCH /v1/reading-sessions/:sessionId` (contracts/books.openapi.yaml →
 * editReadingSession). At least one field must be present (RF-017).
 */
export const editReadingSessionSchema = z
  .object({
    startedAt: z.string().datetime().optional(),
    finishedAt: z.string().datetime().optional(),
    currentPage: z.number().int().min(1).optional(),
  })
  .refine(
    (value) => value.startedAt !== undefined || value.finishedAt !== undefined || value.currentPage !== undefined,
    { message: 'At least one of startedAt, finishedAt or currentPage is required' },
  );

export type EditReadingSessionInput = z.infer<typeof editReadingSessionSchema>;
