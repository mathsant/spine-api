// @ts-check
const tseslint = require('typescript-eslint');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Use named exports only (constitution: "Idioma do código"/no default exports).',
        },
      ],
    },
  },
  {
    // Application code: MongoDB driver only in the data-access layers.
    files: ['src/**/*.ts'],
    ignores: ['src/repositories/**', 'src/db/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'mongodb',
              message: 'Access MongoDB only through src/repositories/** and src/db/** (P2).',
            },
          ],
        },
      ],
    },
  },
  {
    // Application code: read process.env only through src/config and the entrypoint.
    files: ['src/**/*.ts'],
    ignores: ['src/config/**', 'src/server.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Read environment variables only via src/config (RF-012).',
        },
      ],
    },
  },
  {
    // Config files and tests are not part of the layered runtime; relax type-aware noise.
    files: ['**/*.js', '**/*.config.{ts,mts,cts}', 'tests/**/*.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Tooling/config files: CommonJS require and a default export are expected here.
    files: [
      '**/*.js',
      '**/*.cjs',
      '**/*.config.{ts,mts,cts}',
      'eslint.config.js',
      'migrate-mongo-config.js',
    ],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  eslintConfigPrettier,
);
