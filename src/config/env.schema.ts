import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

/**
 * Contract for the process environment (see contracts/env.contract.md).
 * Parses and transforms raw env vars into the camelCase {@link AppConfig}.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().min(1).default('0.0.0.0'),
    MONGO_URI: z
      .string()
      .regex(
        /^mongodb(\+srv)?:\/\/.+/i,
        'must be a mongodb:// or mongodb+srv:// connection string',
      ),
    MONGO_DB_NAME: z
      .string()
      .min(1)
      .regex(/^[^/\\. "$]+$/, 'must not contain any of: / \\ . " $'),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  })
  .transform((raw) => ({
    nodeEnv: raw.NODE_ENV,
    port: raw.PORT,
    host: raw.HOST,
    mongoUri: raw.MONGO_URI,
    mongoDbName: raw.MONGO_DB_NAME,
    logLevel: raw.LOG_LEVEL,
  }));

export type AppConfig = z.infer<typeof envSchema>;
