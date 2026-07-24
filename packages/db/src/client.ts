import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

// Resolve the repo-root .env regardless of the process's cwd (pnpm --filter
// runs scripts with cwd set to the package directory, not the repo root).
loadEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('client.ts: DATABASE_URL is not set (copy .env.example to .env at the repo root)');
}

export const queryClient = postgres(databaseUrl, { max: 10 });
export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
