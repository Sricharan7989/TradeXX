import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { env } from '../env';

export default fp(async (app: FastifyInstance) => {
  await app.register(helmet, { global: true });

  await app.register(cors, {
    origin: env.CORS_ALLOWED_ORIGINS.length > 0 ? env.CORS_ALLOWED_ORIGINS : false,
    credentials: true,
  });

  // Refresh tokens live in an httpOnly SameSite=Strict cookie for web clients.
  await app.register(cookie);
});
