import { type AppConfig, envSchema } from './env.schema';

/**
 * Validates the process environment and returns a typed config.
 * On failure it prints every offending variable and aborts the process
 * (fail-fast — RF-010). No other module should read `process.env` directly.
 */
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const result = envSchema.safeParse(env);

  if (result.success) {
    return result.data;
  }

  console.error('Invalid environment configuration:');
  for (const issue of result.error.issues) {
    const key = issue.path.map((segment) => String(segment)).join('.') || '(root)';
    console.error(`  - ${key}: ${issue.message}`);
  }

  return process.exit(1);
}
