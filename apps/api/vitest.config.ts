import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    // Testcontainers spins up a real Postgres per test file; give it room.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // One Postgres container per file, but files can run in parallel —
    // each gets its own container/db instance from test-context.ts.
    fileParallelism: true,
  },
});
