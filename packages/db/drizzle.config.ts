import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

loadEnv({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://tradex:tradex_dev_password@localhost:5432/tradex';

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
