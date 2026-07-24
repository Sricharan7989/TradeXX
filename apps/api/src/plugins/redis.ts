import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { Redis } from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

export interface RedisPluginOptions {
  redis: Redis;
}

export default fp<RedisPluginOptions>(async (app: FastifyInstance, opts) => {
  app.decorate('redis', opts.redis);
});
