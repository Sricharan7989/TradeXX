import type { Redis } from 'ioredis';
import { z } from 'zod';

import { env } from '../env';

import { rateLimited } from './http-errors';
import { generateOpaqueToken } from './tokens';

// ---------------------------------------------------------------------------
// Login lockout — 5 failed attempts (LOGIN_MAX_FAILED_ATTEMPTS) locks the
// ACCOUNT (not the IP — that's the separate @fastify/rate-limit layer) for
// LOGIN_LOCKOUT_MINUTES.
// ---------------------------------------------------------------------------

const loginFailKey = (email: string): string => `login-fail:${email.toLowerCase()}`;

export async function isAccountLocked(redis: Redis, email: string): Promise<boolean> {
  const count = await redis.get(loginFailKey(email));
  return count !== null && Number(count) >= env.LOGIN_MAX_FAILED_ATTEMPTS;
}

export async function recordFailedLogin(redis: Redis, email: string): Promise<void> {
  const key = loginFailKey(email);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, env.LOGIN_LOCKOUT_MINUTES * 60);
  }
}

export async function clearFailedLogins(redis: Redis, email: string): Promise<void> {
  await redis.del(loginFailKey(email));
}

// ---------------------------------------------------------------------------
// MFA step-up token — issued by POST /auth/login when 2FA is required,
// redeemed by POST /auth/login/2fa. Short-lived, single-use, Redis-backed
// (no DB row needed for a 5-minute-lived value).
// ---------------------------------------------------------------------------

const MFA_TOKEN_TTL_SECONDS = 5 * 60;
const mfaTokenKey = (token: string): string => `mfa:${token}`;
const mfaTokenDataSchema = z.object({ userId: z.string().uuid() });
export type MfaTokenData = z.infer<typeof mfaTokenDataSchema>;

export async function issueMfaToken(redis: Redis, userId: string): Promise<string> {
  const token = generateOpaqueToken();
  const payload: MfaTokenData = { userId };
  await redis.set(mfaTokenKey(token), JSON.stringify(payload), 'EX', MFA_TOKEN_TTL_SECONDS);
  return token;
}

/** Single-use: deletes the token as soon as it's read, valid or not. */
export async function consumeMfaToken(redis: Redis, token: string): Promise<MfaTokenData | null> {
  const key = mfaTokenKey(token);
  const raw = await redis.get(key);
  if (raw === null) return null;
  await redis.del(key);

  const parsed = mfaTokenDataSchema.safeParse(JSON.parse(raw) as unknown);
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// OTP resend limiting — 1 per 60s cooldown, max 5/hour per identifier+purpose.
// ---------------------------------------------------------------------------

const resendCooldownKey = (identifier: string, purpose: string): string =>
  `otp-resend-cooldown:${identifier}:${purpose}`;
const resendCountKey = (identifier: string, purpose: string): string => `otp-resend-count:${identifier}:${purpose}`;

export async function assertCanResendOtp(redis: Redis, identifier: string, purpose: string): Promise<void> {
  const [onCooldown, countRaw] = await Promise.all([
    redis.get(resendCooldownKey(identifier, purpose)),
    redis.get(resendCountKey(identifier, purpose)),
  ]);

  if (onCooldown !== null) {
    throw rateLimited(`Please wait ${env.OTP_RESEND_COOLDOWN_SECONDS}s before requesting another code`);
  }
  if (countRaw !== null && Number(countRaw) >= env.OTP_RESEND_MAX_PER_HOUR) {
    throw rateLimited('Too many code requests for this identifier — try again in an hour');
  }
}

export async function recordOtpResend(redis: Redis, identifier: string, purpose: string): Promise<void> {
  await redis.set(resendCooldownKey(identifier, purpose), '1', 'EX', env.OTP_RESEND_COOLDOWN_SECONDS);
  const countKey = resendCountKey(identifier, purpose);
  const newCount = await redis.incr(countKey);
  if (newCount === 1) {
    await redis.expire(countKey, 60 * 60);
  }
}
