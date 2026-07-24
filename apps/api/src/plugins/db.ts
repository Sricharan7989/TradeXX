import type { Database } from '@tradex/db';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
  }
}

export interface DbPluginOptions {
  db: Database;
}

/**
 * The db instance is always injected explicitly (never imported as a
 * singleton here) so tests can pass a Testcontainers-backed instance and
 * production/dev can pass the real one — one code path, no env-timing
 * surprises between the two.
 */
export default fp<DbPluginOptions>(async (app: FastifyInstance, opts) => {
  app.decorate('db', opts.db);
});
