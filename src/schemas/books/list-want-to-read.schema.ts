import { z } from 'zod';

/** Querystring of `GET /v1/me/want-to-read` (contracts/books.openapi.yaml → listWantToRead). */
export const listWantToReadSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListWantToReadInput = z.infer<typeof listWantToReadSchema>;
