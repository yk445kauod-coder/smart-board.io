import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'App.tsx',
      'components/**',
      'services/**',
      'lib/**',
      'types.ts',
      'index.tsx',
      'functions/**',
      'worker/**',
      'worker-api.ts',
      'data/**',
      'tests/*.test.ts',
      'tests/*.ts',
      'public/**',
      'brand-assets/**',
      '.wrangler/**',
      '.neon/**',
      'test-results/**',
      'playwright-report/**',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['tests/e2e/**/*.ts', 'tests/integration/**/*.ts', 'playwright.config.ts', 'drizzle.config.ts'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', URL: 'readonly', fetch: 'readonly' },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'shared/**/*.ts', 'api/**/*.ts', 'db/**/*.ts'],
    languageOptions: {
      globals: { console: 'readonly', fetch: 'readonly', crypto: 'readonly', URL: 'readonly', Response: 'readonly', Request: 'readonly', Headers: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', localStorage: 'readonly', window: 'readonly', document: 'readonly', navigator: 'readonly', indexedDB: 'readonly', WebSocket: 'readonly' },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
);
