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
    ACCESS_TOKEN_SECRET: z
      .string()
      .min(32, 'must be at least 32 characters (HS256 signing secret)'),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900_000),
    OPEN_LIBRARY_BASE_URL: z.string().url().default('https://openlibrary.org'),
    OPEN_LIBRARY_TIMEOUT_MS: z.coerce.number().int().min(100).default(5000),
  })
  .transform((raw) => ({
    nodeEnv: raw.NODE_ENV,
    port: raw.PORT,
    host: raw.HOST,
    mongoUri: raw.MONGO_URI,
    mongoDbName: raw.MONGO_DB_NAME,
    logLevel: raw.LOG_LEVEL,
    accessTokenSecret: raw.ACCESS_TOKEN_SECRET,
    authRateLimitMax: raw.AUTH_RATE_LIMIT_MAX,
    authRateLimitWindowMs: raw.AUTH_RATE_LIMIT_WINDOW_MS,
    openLibraryBaseUrl: raw.OPEN_LIBRARY_BASE_URL,
    openLibraryTimeoutMs: raw.OPEN_LIBRARY_TIMEOUT_MS,
  }));

export type AppConfig = z.infer<typeof envSchema>;
