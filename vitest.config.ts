import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.spec.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.spec.ts'],
          environment: 'node',
          // mongodb-memory-server may download a binary on first run.
          hookTimeout: 120_000,
          testTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/server.ts'],
      thresholds: {
        'src/services/**': {
          statements: 70,
          branches: 70,
          functions: 70,
          lines: 70,
        },
      },
    },
  },
});
