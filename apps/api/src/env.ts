import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseEncryptionKey } from '@tradex/core';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// apps/api/src/env.ts -> repo root is three levels up.
export const repoRootDir = fileURLToPath(new URL('../../../', import.meta.url));

// Resolve the repo-root .env regardless of cwd (dev via tsx, prod via a
// built dist/index.js, or test via vitest all start from different cwds).
loadEnv({ path: path.join(repoRootDir, '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default('')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_ACCESS_TTL: z
    .string()
    .regex(/^\d+(s|m|h|d)$/, 'JWT_ACCESS_TTL must look like "15m", "1h", etc')
    .default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)'),

  OTP_LENGTH: z.coerce.number().int().min(4).max(10).default(6),
  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  OTP_RESEND_MAX_PER_HOUR: z.coerce.number().int().positive().default(5),

  TOTP_ISSUER: z.string().default('Tradex'),

  LOGIN_MAX_FAILED_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),

  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW: z.string().default('1 minute'),

  UPLOAD_DIR: z.string().default('./apps/api/uploads'),
  UPLOAD_MAX_SIZE_MB: z.coerce.number().int().positive().default(10),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('env.ts: environment validation failed — see printed errors above');
}

export const env = parsed.data;
export const encryptionKey = parseEncryptionKey(env.ENCRYPTION_KEY);
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

// UPLOAD_DIR is documented as repo-root-relative (see .env.example); resolve
// it against the repo root rather than process.cwd(), which varies by how
// the server was launched (tsx from apps/api/, a built dist/, vitest, etc).
export const uploadDir = path.isAbsolute(env.UPLOAD_DIR)
  ? env.UPLOAD_DIR
  : path.resolve(repoRootDir, env.UPLOAD_DIR);
