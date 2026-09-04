import { z } from 'zod';

/** Body of `POST /v1/auth/login` (contracts/auth.openapi.yaml → LoginRequest). */
export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(72),
});

export type LoginInput = z.infer<typeof loginSchema>;
