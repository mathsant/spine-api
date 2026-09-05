import { z } from 'zod';

/** Querystring of `GET /v1/activities/:activityId/comments` (contracts/interactions.openapi.yaml → listComments). */
export const listCommentsSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListCommentsInput = z.infer<typeof listCommentsSchema>;
