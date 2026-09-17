// @ts-check
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

/**
 * N-Guard — ESLint flat config (ESLint 9+)
 * Covers srv/, agent/, and app/ TypeScript/TSX sources.
 */

/** @type {import('eslint').Linter.Config[]} */
export default [
  // ── Global ignores ────────────────────────────────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/gen/**',
      '**/@cds-models/**',
      'db/**',
      '*.cds',
    ],
  },

  // ── TypeScript sources (srv + agent) ─────────────────────────────────────
  {
    files: ['srv/src/**/*.ts', 'agent/src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion  : 'latest',
        sourceType   : 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs['recommended'].rules,
      '@typescript-eslint/no-explicit-any'         : 'warn',
      '@typescript-eslint/no-unused-vars'          : ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion'   : 'warn',
      'no-console'                                 : ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },

  // ── React / TSX sources (app) ─────────────────────────────────────────────
  {
    files: ['app/src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion  : 'latest',
        sourceType   : 'module',
        ecmaFeatures : { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs['recommended'].rules,
      '@typescript-eslint/no-explicit-any'         : 'warn',
      '@typescript-eslint/no-unused-vars'          : ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console'                                 : ['warn', { allow: ['warn', 'error'] }],
      // React-specific
      'react/prop-types'                           : 'off',
    },
  },
];
