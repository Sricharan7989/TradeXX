import { type Database, sessions } from '@tradex/db';
import type { SessionPlatform } from '@tradex/types';
import { and, eq, isNull } from 'drizzle-orm';

import { internalError, tokenInvalid, tokenReuseDetected } from './http-errors';
import { generateOpaqueToken, hashToken, refreshTokenExpiryDate } from './tokens';

export interface DeviceContext {
  deviceId: string;
  deviceName?: string | undefined;
  platform: SessionPlatform;
}

export interface CreateSessionParams extends DeviceContext {
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface SessionWithToken {
  id: string;
  rawRefreshToken: string;
}

export async function createSession(db: Database, params: CreateSessionParams): Promise<SessionWithToken> {
  const rawRefreshToken = generateOpaqueToken();
  const [session] = await db
    .insert(sessions)
    .values({
      userId: params.userId,
      refreshTokenHash: hashToken(rawRefreshToken),
      deviceId: params.deviceId,
      deviceName: params.deviceName ?? null,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      platform: params.platform,
      expiresAt: refreshTokenExpiryDate(),
      lastUsedAt: new Date(),
    })
    .returning({ id: sessions.id });

  if (!session) throw internalError('createSession: insert returned no row');
  return { id: session.id, rawRefreshToken };
}

export interface RotateResult {
  userId: string;
  newSession: SessionWithToken;
}

/**
 * Validates a presented raw refresh token and rotates it: revokes the
 * matched session, creates a fresh one for the same device. If the token
 * hash matches an ALREADY-REVOKED session, that's a replay of a rotated-out
 * token — a strong signal of theft — so every session for that user is
 * revoked and a TOKEN_REUSE_DETECTED error is thrown.
 */
export async function rotateRefreshToken(db: Database, rawToken: string): Promise<RotateResult> {
  const tokenHash = hashToken(rawToken);
  const [session] = await db.select().from(sessions).where(eq(sessions.refreshTokenHash, tokenHash)).limit(1);

  if (!session) throw tokenInvalid();

  if (session.revokedAt !== null) {
    await revokeAllSessions(db, session.userId);
    throw tokenReuseDetected();
  }

  if (session.expiresAt.getTime() < Date.now()) {
    throw tokenInvalid('Refresh token expired');
  }

  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, session.id));

  const newSession = await createSession(db, {
    userId: session.userId,
    deviceId: session.deviceId,
    deviceName: session.deviceName ?? undefined,
    platform: session.platform as SessionPlatform,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
  });

  return { userId: session.userId, newSession };
}

export async function revokeSessionByToken(db: Database, rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.refreshTokenHash, tokenHash), isNull(sessions.revokedAt)));
}

/** Revokes every active session for a user — used on password reset and reuse-detection. */
export async function revokeAllSessions(db: Database, userId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

/** Returns true if a session belonging to `userId` was revoked. */
export async function revokeSessionById(db: Database, userId: string, sessionId: string): Promise<boolean> {
  const result = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isNull(sessions.revokedAt)))
    .returning({ id: sessions.id });
  return result.length > 0;
}
