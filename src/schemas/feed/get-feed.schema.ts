import { z } from 'zod';

/** Querystring of `GET /v1/feed` (contracts/feed.openapi.yaml → getFeed). */
export const getFeedSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type GetFeedInput = z.infer<typeof getFeedSchema>;
