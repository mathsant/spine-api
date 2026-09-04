import { z } from 'zod';

/**
 * Body of `PATCH /v1/reviews/:reviewId` (contracts/reviews.openapi.yaml → editReview). At
 * least one field must be present (RF-005); `text` can be set to `null` to clear it.
 */
export const editReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    text: z.string().max(2000).nullable().optional(),
    containsSpoiler: z.boolean().optional(),
  })
  .refine(
    (value) => value.rating !== undefined || value.text !== undefined || value.containsSpoiler !== undefined,
    { message: 'At least one of rating, text or containsSpoiler is required' },
  );

export type EditReviewInput = z.infer<typeof editReviewSchema>;
