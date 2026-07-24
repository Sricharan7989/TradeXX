import type { Database } from '@tradex/db';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

import { isProduction, isTest } from './env';
import authRoutes from './modules/auth/auth.routes';
import kycRoutes from './modules/kyc/kyc.routes';
import meRoutes from './modules/me/me.routes';
import twofaRoutes from './modules/twofa/twofa.routes';
import dbPlugin from './plugins/db';
import errorHandlerPlugin from './plugins/error-handler';
import redisPlugin from './plugins/redis';
import securityPlugin from './plugins/security';

export interface BuildAppOptions {
  db: Database;
  redis: Redis;
}

/**
 * Builds (but does not start listening) a fully-wired Fastify instance.
 * db/redis are always passed in explicitly — production/dev pass the real
 * singletons (src/index.ts), tests pass Testcontainers-backed instances.
 * This is the one place that assembles the app, so tests exercise the exact
 * same plugin/route wiring as production.
 */
export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: isTest ? false : { level: isProduction ? 'info' : 'debug' },
    trustProxy: true,
  });

  await app.register(errorHandlerPlugin);
  await app.register(dbPlugin, { db: opts.db });
  await app.register(redisPlugin, { redis: opts.redis });
  await app.register(securityPlugin);

  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(twofaRoutes, { prefix: '/v1/2fa' });
  await app.register(meRoutes, { prefix: '/v1/me' });
  await app.register(kycRoutes, { prefix: '/v1/kyc' });

  app.get('/health', async () => ({ status: 'ok' as const }));

  return app;
}
