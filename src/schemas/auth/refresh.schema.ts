import { z } from 'zod';

/** Body of `POST /v1/auth/refresh` (contracts/auth.openapi.yaml → RefreshRequest). */
export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshInput = z.infer<typeof refreshSchema>;
