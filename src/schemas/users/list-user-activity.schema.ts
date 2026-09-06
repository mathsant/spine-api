import { z } from 'zod';

/** Querystring of `GET /v1/users/:userId/activity` (011 — D2). Mirrors `getFeedSchema`. */
export const listUserActivitySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListUserActivityInput = z.infer<typeof listUserActivitySchema>;
