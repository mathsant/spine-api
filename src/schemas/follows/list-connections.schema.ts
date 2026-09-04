import { z } from 'zod';

/**
 * Querystring shared by `GET /v1/me/followers` and `GET /v1/me/following`
 * (contracts/profile-follow.openapi.yaml → listFollowers/listFollowing).
 */
export const listConnectionsSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListConnectionsInput = z.infer<typeof listConnectionsSchema>;
