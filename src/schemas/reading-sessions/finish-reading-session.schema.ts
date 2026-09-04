import { z } from 'zod';

/**
 * Body of `POST /v1/reading-sessions/:sessionId/finish`
 * (contracts/books.openapi.yaml → finishReadingSession). `finishedAt` defaults to now
 * in the service when absent.
 */
export const finishReadingSessionSchema = z.object({
  finishedAt: z.string().datetime().optional(),
});

export type FinishReadingSessionInput = z.infer<typeof finishReadingSessionSchema>;
