import { z } from 'zod';

/** Body of `POST /v1/auth/logout` (contracts/auth.openapi.yaml → LogoutRequest). */
export const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

export type LogoutInput = z.infer<typeof logoutSchema>;
