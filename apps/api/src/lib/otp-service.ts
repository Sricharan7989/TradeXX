import { generateOtp, hashOtp, verifyOtp as verifyOtpHash } from '@tradex/core';
import { type Database, otpVerifications } from '@tradex/db';
import type { OtpPurpose } from '@tradex/types';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { env } from '../env';

import { otpExpired, otpInvalid, otpMaxAttempts } from './http-errors';

// Any strong server-side secret works as an HMAC pepper for OTP hashing;
// reusing the JWT access secret avoids introducing a dedicated env var.
const OTP_PEPPER = env.JWT_ACCESS_SECRET;

export interface IssueOtpParams {
  userId: string | null;
  identifier: string;
  purpose: OtpPurpose;
}

/**
 * Generates, hashes, and persists a new OTP. Phase 1 has no real email/SMS
 * provider wired up — the code is logged server-side so local dev/tests can
 * read it. A later phase swaps this for a real provider (SES/SNS/etc).
 */
export async function issueOtp(db: Database, params: IssueOtpParams): Promise<string> {
  const otp = generateOtp(env.OTP_LENGTH);
  const otpHash = hashOtp(otp, OTP_PEPPER);
  const expiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000);

  await db.insert(otpVerifications).values({
    userId: params.userId,
    identifier: params.identifier,
    otpHash,
    purpose: params.purpose,
    expiresAt,
  });

  console.log(`[otp:dev] ${params.purpose} code for ${params.identifier}: ${otp}`);
  return otp;
}

export interface ConsumeOtpParams {
  identifier: string;
  purpose: OtpPurpose;
  otp: string;
}

export interface ConsumedOtp {
  id: string;
  userId: string | null;
}

/**
 * Validates and single-use-consumes the most recent unconsumed OTP for an
 * identifier+purpose. Throws AppError (otpInvalid/otpExpired/otpMaxAttempts)
 * on any failure — callers don't need to branch on the reason beyond that.
 */
export async function consumeOtp(db: Database, params: ConsumeOtpParams): Promise<ConsumedOtp> {
  const [record] = await db
    .select()
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.identifier, params.identifier),
        eq(otpVerifications.purpose, params.purpose),
        isNull(otpVerifications.consumedAt),
      ),
    )
    .orderBy(desc(otpVerifications.createdAt))
    .limit(1);

  if (!record) throw otpInvalid();
  if (record.expiresAt.getTime() < Date.now()) throw otpExpired();
  if (record.attempts >= env.OTP_MAX_ATTEMPTS) throw otpMaxAttempts();

  const isValid = verifyOtpHash(params.otp, record.otpHash, OTP_PEPPER);
  if (!isValid) {
    await db
      .update(otpVerifications)
      .set({ attempts: record.attempts + 1 })
      .where(eq(otpVerifications.id, record.id));
    throw otpInvalid();
  }

  await db.update(otpVerifications).set({ consumedAt: new Date() }).where(eq(otpVerifications.id, record.id));
  return { id: record.id, userId: record.userId };
}
