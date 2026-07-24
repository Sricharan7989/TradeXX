import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/money.ts', 'src/market-time.ts', 'src/validators.ts', 'src/crypto.ts'],
      thresholds: {
        // GLOBAL RULE: 100% coverage on money.ts, validators.ts, market-time.ts.
        'src/money.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/market-time.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/validators.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
});
