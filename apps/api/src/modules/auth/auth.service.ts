import { hashPassword, isValidIndianPhone, verifyPassword } from '@tradex/core';
import { type Database, sessions, userSettings, users } from '@tradex/db';
import type { DeviceContext, OtpPurpose, SessionDto } from '@tradex/types';
import { and, eq, isNull } from 'drizzle-orm';
import type { Redis } from 'ioredis';

import {
  accountLocked,
  conflict,
  invalidCredentials,
  mfaInvalid,
  otpInvalid,
} from '../../lib/http-errors';
import { consumeOtp, issueOtp } from '../../lib/otp-service';
import {
  assertCanResendOtp,
  clearFailedLogins,
  consumeMfaToken,
  isAccountLocked,
  issueMfaToken,
  recordFailedLogin,
  recordOtpResend,
} from '../../lib/redis-helpers';
import {
  createSession,
  revokeAllSessions,
  revokeSessionById,
  revokeSessionByToken,
  rotateRefreshToken,
} from '../../lib/sessions';
import { accessTokenExpiresInSeconds, signAccessToken } from '../../lib/tokens';
import { verifyTotpOrBackupCode } from '../twofa/twofa.service';

// Precomputed once at startup so a "user not found" login takes roughly the
// same time as a real password check — avoids a trivial timing side-channel
// that would otherwise reveal account existence.
const DUMMY_PASSWORD_HASH = await hashPassword('tradex-dummy-password-for-constant-time-compare');

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

// ---------------------------------------------------------------------------
// signup
// ---------------------------------------------------------------------------

export async function signup(
  db: Database,
  input: { email: string; phone: string; password: string },
): Promise<{ userId: string }> {
  const existing = await db.query.users.findFirst({
    where: (u, { or: orOp }) => orOp(eq(u.email, input.email), eq(u.phone, input.phone)),
  });
  if (existing) {
    throw conflict('An account with this email or phone already exists');
  }

  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({ email: input.email, phone: input.phone, passwordHash })
    .returning({ id: users.id });
  if (!user) throw new Error('signup: insert returned no row');

  await db.insert(userSettings).values({ userId: user.id }).onConflictDoNothing();
  await issueOtp(db, { userId: user.id, identifier: input.email, purpose: 'SIGNUP' });

  return { userId: user.id };
}

// ---------------------------------------------------------------------------
// verify-otp
// ---------------------------------------------------------------------------

export async function verifyOtpAndMarkFlags(
  db: Database,
  input: { identifier: string; otp: string; purpose: OtpPurpose },
): Promise<void> {
  const consumed = await consumeOtp(db, input);
  if (!consumed.userId) return;

  const isPhoneIdentifier = isValidIndianPhone(input.identifier);
  if (input.purpose === 'SIGNUP' || input.purpose === 'PHONE_VERIFY') {
    await db
      .update(users)
      .set(isPhoneIdentifier ? { isPhoneVerified: true } : { isEmailVerified: true })
      .where(eq(users.id, consumed.userId));
  }
}

// ---------------------------------------------------------------------------
// resend-otp
// ---------------------------------------------------------------------------

export async function resendOtp(
  db: Database,
  redis: Redis,
  input: { identifier: string; purpose: OtpPurpose },
): Promise<void> {
  await assertCanResendOtp(redis, input.identifier, input.purpose);

  const user = await db.query.users.findFirst({
    where: (u, { or: orOp }) => orOp(eq(u.email, input.identifier), eq(u.phone, input.identifier)),
  });

  // Enumeration-safe: record the rate-limit hit either way, but only
  // actually send a code if an account exists.
  await recordOtpResend(redis, input.identifier, input.purpose);
  if (user) {
    await issueOtp(db, { userId: user.id, identifier: input.identifier, purpose: input.purpose });
  }
}

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

export type LoginResult =
  | { mfaRequired: true; mfaToken: string }
  | {
      mfaRequired: false;
      accessToken: string;
      expiresIn: number;
      refreshToken: string;
      user: { id: string; email: string; status: string };
    };

export async function login(
  db: Database,
  redis: Redis,
  input: { email: string; password: string; device: DeviceContext },
  ctx: RequestContext,
): Promise<LoginResult> {
  if (await isAccountLocked(redis, input.email)) {
    throw accountLocked();
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });

  const passwordOk = await verifyPassword(user?.passwordHash ?? DUMMY_PASSWORD_HASH, input.password);
  if (!user || !passwordOk) {
    await recordFailedLogin(redis, input.email);
    throw invalidCredentials();
  }

  await clearFailedLogins(redis, input.email);

  if (user.is2faEnabled) {
    const mfaToken = await issueMfaToken(redis, user.id);
    return { mfaRequired: true, mfaToken };
  }

  const session = await createSession(db, {
    userId: user.id,
    deviceId: input.device.device_id,
    deviceName: input.device.device_name,
    platform: input.device.platform,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  const accessToken = signAccessToken({ sub: user.id, sid: session.id, email: user.email });
  return {
    mfaRequired: false,
    accessToken,
    expiresIn: accessTokenExpiresInSeconds(),
    refreshToken: session.rawRefreshToken,
    user: { id: user.id, email: user.email, status: user.status },
  };
}

// ---------------------------------------------------------------------------
// login/2fa
// ---------------------------------------------------------------------------

export async function loginWithTwoFactor(
  db: Database,
  redis: Redis,
  input: { mfaToken: string; totpCode: string; device: DeviceContext },
  ctx: RequestContext,
): Promise<{
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  user: { id: string; email: string; status: string };
}> {
  const mfaData = await consumeMfaToken(redis, input.mfaToken);
  if (!mfaData) throw mfaInvalid();

  const user = await db.query.users.findFirst({ where: eq(users.id, mfaData.userId) });
  if (!user) throw mfaInvalid();

  const codeOk = await verifyTotpOrBackupCode(db, user, input.totpCode);
  if (!codeOk) throw mfaInvalid();

  const session = await createSession(db, {
    userId: user.id,
    deviceId: input.device.device_id,
    deviceName: input.device.device_name,
    platform: input.device.platform,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  const accessToken = signAccessToken({ sub: user.id, sid: session.id, email: user.email });
  return {
    accessToken,
    expiresIn: accessTokenExpiresInSeconds(),
    refreshToken: session.rawRefreshToken,
    user: { id: user.id, email: user.email, status: user.status },
  };
}

// ---------------------------------------------------------------------------
// refresh
// ---------------------------------------------------------------------------

export async function refresh(
  db: Database,
  rawRefreshToken: string,
): Promise<{ accessToken: string; expiresIn: number; refreshToken: string }> {
  const { userId, newSession } = await rotateRefreshToken(db, rawRefreshToken);
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw invalidCredentials();

  const accessToken = signAccessToken({ sub: user.id, sid: newSession.id, email: user.email });
  return { accessToken, expiresIn: accessTokenExpiresInSeconds(), refreshToken: newSession.rawRefreshToken };
}

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

export async function logout(db: Database, rawRefreshToken: string): Promise<void> {
  await revokeSessionByToken(db, rawRefreshToken);
}

// ---------------------------------------------------------------------------
// forgot-password / reset-password
// ---------------------------------------------------------------------------

export async function forgotPassword(db: Database, identifier: string): Promise<void> {
  const user = await db.query.users.findFirst({
    where: (u, { or: orOp }) => orOp(eq(u.email, identifier), eq(u.phone, identifier)),
  });
  // Enumeration-safe: always behave as if it succeeded.
  if (user) {
    await issueOtp(db, { userId: user.id, identifier, purpose: 'RESET_PASSWORD' });
  }
}

export async function resetPassword(
  db: Database,
  input: { identifier: string; otp: string; newPassword: string },
): Promise<void> {
  const consumed = await consumeOtp(db, {
    identifier: input.identifier,
    purpose: 'RESET_PASSWORD',
    otp: input.otp,
  });
  if (!consumed.userId) throw otpInvalid();

  const passwordHash = await hashPassword(input.newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, consumed.userId));

  // Password reset invalidates every existing session — same response to a
  // credential-compromise scenario as detected refresh-token reuse.
  await revokeAllSessions(db, consumed.userId);
}

// ---------------------------------------------------------------------------
// sessions
// ---------------------------------------------------------------------------

export async function listSessions(db: Database, userId: string, currentSessionId: string): Promise<SessionDto[]> {
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));

  return rows
    .filter((row) => row.expiresAt.getTime() > Date.now())
    .map((row) => ({
      id: row.id,
      device_id: row.deviceId,
      device_name: row.deviceName,
      platform: row.platform as SessionDto['platform'],
      ip_address: row.ipAddress,
      user_agent: row.userAgent,
      is_current: row.id === currentSessionId,
      last_used_at: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
      created_at: row.createdAt.toISOString(),
      expires_at: row.expiresAt.toISOString(),
    }));
}

export async function revokeSession(db: Database, userId: string, sessionId: string): Promise<boolean> {
  return revokeSessionById(db, userId, sessionId);
}
