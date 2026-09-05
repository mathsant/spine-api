import { z } from 'zod';

/**
 * Body of `POST /v1/activities/:activityId/comments` (contracts/interactions.openapi.yaml →
 * createComment). `parentCommentId`, when present, must point to a top-level comment of the
 * same activity — enforced by the service, not the schema (RF-007, RF-010).
 */
export const createCommentSchema = z.object({
  text: z.string().trim().min(1),
  parentCommentId: z.string().min(1).optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
