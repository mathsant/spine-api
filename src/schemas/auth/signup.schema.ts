import { z } from 'zod';

/**
 * Body of `POST /v1/auth/signup` (contracts/auth.openapi.yaml → SignupRequest).
 * `handle` accepts mixed case on input and is lowercased by the service (D9); the
 * canonical, immutable handle is the lowercase form.
 */
export const signupSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(72),
  handle: z
    .string()
    .regex(/^[A-Za-z0-9_]{3,30}$/, 'must be 3-30 characters: letters, digits or underscore'),
  displayName: z.string().trim().min(1).max(50),
});

export type SignupInput = z.infer<typeof signupSchema>;
