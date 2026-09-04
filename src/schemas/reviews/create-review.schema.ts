import { z } from 'zod';

/**
 * Body of `POST /v1/reading-sessions/:sessionId/review` (contracts/reviews.openapi.yaml →
 * createReview). `rating` is the only required field (RF-001, RF-011).
 */
export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().max(2000).optional(),
  containsSpoiler: z.boolean().optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
