// Root flat ESLint config — resolved automatically by `eslint .` run from
// any package directory (ESLint 9 searches upward from cwd), so every
// package's `"lint": "eslint ."` script shares this one config rather than
// duplicating it per-package.
import globals from 'globals';

import { baseConfig, reactConfig } from './packages/config/eslint-preset.js';

const [react] = reactConfig;

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...baseConfig,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: react.plugins,
    rules: react.rules,
    settings: react.settings,
    languageOptions: {
      ...react.languageOptions,
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    plugins: react.plugins,
    rules: react.rules,
    settings: react.settings,
    languageOptions: {
      ...react.languageOptions,
      globals: { ...globals.browser },
    },
  },
  {
    files: ['**/*.config.{js,ts,mjs,cjs}', '**/drizzle.config.ts'],
    rules: {
      'import/no-default-export': 'off',
    },
  },
  {
    // apps/mobile has no "type": "module" in its package.json, so these two
    // are genuinely loaded as CommonJS by their respective tools (Metro
    // requires metro.config.js via CJS `require`; Tailwind/NativeWind's
    // tooling expects tailwind.config.js in the same form) — require() here
    // is correct, not a style violation.
    files: ['apps/mobile/metro.config.js', 'apps/mobile/tailwind.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
