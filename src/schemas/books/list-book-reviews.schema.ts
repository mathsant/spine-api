import { z } from 'zod';

/** Querystring of `GET /v1/books/:olid/reviews` (contracts/openapi-delta.md → listBookReviewsByFollowing). */
export const listBookReviewsSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListBookReviewsInput = z.infer<typeof listBookReviewsSchema>;
