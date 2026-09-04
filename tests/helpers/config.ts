import type { AppConfig } from '../../src/config';

/** A valid AppConfig for integration tests; override what a test cares about. */
export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'test',
    port: 0,
    host: '127.0.0.1',
    mongoUri: 'mongodb://127.0.0.1:59999/?serverSelectionTimeoutMS=500',
    mongoDbName: 'test',
    logLevel: 'silent',
    accessTokenSecret: 'integration-test-access-token-secret-0123456789',
    authRateLimitMax: 10,
    authRateLimitWindowMs: 900_000,
    ...overrides,
  };
}
