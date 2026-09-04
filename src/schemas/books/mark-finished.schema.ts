import { z } from 'zod';

/** Body of `POST /v1/books/:olid/mark-finished` (contracts/books.openapi.yaml → markFinished). */
export const markFinishedSchema = z.object({
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime(),
});

export type MarkFinishedInput = z.infer<typeof markFinishedSchema>;
