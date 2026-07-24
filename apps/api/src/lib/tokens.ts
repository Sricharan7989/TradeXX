import { createHash, randomBytes } from 'node:crypto';

import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { env } from '../env';

const accessTokenPayloadSchema = z.object({
  sub: z.string().uuid(), // user id
  sid: z.string().uuid(), // session id — lets /auth/sessions mark "is_current"
  email: z.string(),
});
export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;

const DURATION_MULTIPLIER_SECONDS = { s: 1, m: 60, h: 3600, d: 86_400 } as const;
type DurationUnit = keyof typeof DURATION_MULTIPLIER_SECONDS;
const DURATION_PATTERN = /^(\d+)(s|m|h|d)$/;

/** Parses simple "<n><unit>" durations (e.g. "15m", "1h") into seconds. */
export function parseDurationToSeconds(duration: string, fallbackSeconds: number): number {
  const match = DURATION_PATTERN.exec(duration);
  if (!match) return fallbackSeconds;
  const amountStr = match[1];
  const unit = match[2];
  if (amountStr === undefined || unit === undefined) return fallbackSeconds;
  return Number(amountStr) * DURATION_MULTIPLIER_SECONDS[unit as DurationUnit];
}

export function signAccessToken(payload: AccessTokenPayload): string {
  // @types/jsonwebtoken types `expiresIn` as a branded string literal union
  // (via the `ms` package) rather than plain `string` — env.JWT_ACCESS_TTL is
  // validated at startup (env.ts) to be a real "<n><unit>" duration, so this
  // cast just bridges an overly-narrow upstream type, not an unsafe value.
  const options: jwt.SignOptions = { expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function accessTokenExpiresInSeconds(): number {
  return parseDurationToSeconds(env.JWT_ACCESS_TTL, 15 * 60);
}

/** Throws AppError-free (jsonwebtoken's own errors) — callers wrap with tokenInvalid()/tokenExpired(). */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded: unknown = jwt.verify(token, env.JWT_ACCESS_SECRET);
  return accessTokenPayloadSchema.parse(decoded);
}

/** A cryptographically random opaque token (refresh tokens, MFA step-up tokens). */
export function generateOpaqueToken(): string {
  return randomBytes(48).toString('hex');
}

/** SHA-256 hex digest — refresh tokens are stored/looked-up by hash only, never the raw value. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiryDate(): Date {
  return new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function refreshCookieMaxAgeSeconds(): number {
  return env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60;
}
