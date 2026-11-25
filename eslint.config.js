import js from '@eslint/js';
import globals from 'globals';

const extensionRules = {
  eqeqeq: ['error', 'always'],
  'no-var': 'error',
  'prefer-const': 'error',
  'no-console': ['warn', { allow: ['debug', 'warn', 'error'] }],
  'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
};

export default [
  { ignores: ['node_modules/'] },
  js.configs.recommended,
  {
    files: ['extension/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.webextensions },
    },
    rules: extensionRules,
  },
  {
    // Content scripts are classic scripts injected together into the same
    // isolated world: top-level functions in filter-core.js are globals used by filter.js.
    files: ['extension/content/**/*.js'],
    languageOptions: { sourceType: 'script' },
    rules: {
      ...extensionRules,
      'no-unused-vars': ['error', { vars: 'local', argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['tests/**/*.js', 'scripts/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    // Store screenshot helpers run as classic scripts inside the browser page.
    files: ['store/assets-src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: { ...globals.browser },
    },
  },
  {
    // End-to-end tests contain callbacks that run inside the browser page.
    files: ['tests/e2e/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
