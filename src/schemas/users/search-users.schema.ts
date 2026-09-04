import { z } from 'zod';

/** Querystring of `GET /v1/users/search` (contracts/profile-follow.openapi.yaml → searchUsers). */
export const searchUsersSchema = z.object({
  q: z.string().trim().min(2).max(100),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchUsersInput = z.infer<typeof searchUsersSchema>;
