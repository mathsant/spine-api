import { z } from 'zod';

/**
 * Body of `POST /v1/auth/change-password` (contracts/auth.openapi.yaml →
 * ChangePasswordRequest). `newPassword` follows the same policy as signup.
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72),
  refreshToken: z.string().min(1).optional(),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
