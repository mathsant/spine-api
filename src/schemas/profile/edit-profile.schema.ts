import { z } from 'zod';

/**
 * Body of `PATCH /v1/me` (contracts/profile-follow.openapi.yaml → EditProfileRequest).
 * `handle` is never accepted here (immutable, RF-003). At least one of `displayName`/`bio`
 * must be present (RF-002).
 */
export const editProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(50).optional(),
    bio: z.string().trim().max(280).nullable().optional(),
  })
  .refine((data) => data.displayName !== undefined || data.bio !== undefined, {
    message: 'At least one of displayName or bio must be provided',
  });

export type EditProfileInput = z.infer<typeof editProfileSchema>;
