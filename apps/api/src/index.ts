import { db } from '@tradex/db';
import { Redis } from 'ioredis';

import { buildApp } from './app';
import { env } from './env';

async function main(): Promise<void> {
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const app = await buildApp({ db, redis });

  app.addHook('onClose', async () => {
    await redis.quit();
  });

  await app.listen({ host: env.API_HOST, port: env.API_PORT });
  app.log.info(`Tradex API listening on http://${env.API_HOST}:${env.API_PORT}`);
}

main().catch((error: unknown) => {
  console.error('Failed to start server:', error);
  process.exitCode = 1;
});
