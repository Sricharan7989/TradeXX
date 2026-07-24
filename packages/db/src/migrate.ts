import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

loadEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url));

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('migrate.ts: DATABASE_URL is not set');
  }

  const migrationClient = postgres(databaseUrl, { max: 1 });
  const migrationDb = drizzle(migrationClient);

  console.log('Running migrations...');
  await migrate(migrationDb, { migrationsFolder });
  console.log('Migrations complete.');

  await migrationClient.end();
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
