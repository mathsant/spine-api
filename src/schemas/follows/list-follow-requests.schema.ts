import { z } from 'zod';

/** Querystring of `GET /v1/me/follow-requests` (contracts/profile-follow.openapi.yaml → listFollowRequests). */
export const listFollowRequestsSchema = z.object({
  direction: z.enum(['incoming', 'outgoing']).default('incoming'),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListFollowRequestsInput = z.infer<typeof listFollowRequestsSchema>;
