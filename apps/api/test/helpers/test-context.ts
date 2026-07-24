import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Database } from '@tradex/db';
import * as schema from '@tradex/db/schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';
import postgres, { type Sql } from 'postgres';

// apps/api/test/helpers/test-context.ts -> repo root is 4 levels up.
const migrationsFolder = fileURLToPath(new URL('../../../../packages/db/migrations', import.meta.url));

export interface TestContext {
  app: FastifyInstance;
  db: Database;
  redis: Redis;
  /** Sets a unique X-Forwarded-For per test group so @fastify/rate-limit's
   *  per-IP counters never leak between unrelated tests (trustProxy: true
   *  means Fastify honors this header for request.ip). */
  nextIp: () => string;
  teardown: () => Promise<void>;
}

let ipCounter = 1;

/**
 * Spins up a real Postgres 16 container (Testcontainers), migrates it with
 * the same SQL migrations used in production, and reuses the already-running
 * docker-compose Redis on a dedicated logical DB (flushed up front) — the
 * spec calls for Postgres via Testcontainers specifically; Redis here is
 * just cache/session/rate-limit storage, not the system under test.
 */
export async function createTestContext(): Promise<TestContext> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('tradex_test')
    .withUsername('tradex_test')
    .withPassword('tradex_test')
    .start();

  const client: Sql = postgres(container.getConnectionUri(), { max: 5 });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });

  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    db: 15,
    maxRetriesPerRequest: null,
  });
  await redis.flushdb();

  // Dynamic import so `../../src/app` (and its env.ts side effects) only
  // resolve after the above setup — avoids any import-order surprises.
  const { buildApp } = await import('../../src/app');
  const app = await buildApp({ db, redis });
  await app.ready();

  return {
    app,
    db,
    redis,
    nextIp: () => `10.${Math.floor(ipCounter / 65_536) % 256}.${Math.floor(ipCounter / 256) % 256}.${(ipCounter++ % 254) + 1}`,
    teardown: async () => {
      await app.close();
      await redis.quit();
      await client.end();
      await container.stop();
    },
  };
}
