import { createHash } from 'node:crypto';

import { generateBackupCodes, verifyPassword } from '@tradex/core';
import { type BackupCodeHash, type Database, users } from '@tradex/db';
import { eq } from 'drizzle-orm';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

import { env } from '../../env';
import { badRequest, mfaInvalid, unauthorized } from '../../lib/http-errors';

type UserRow = typeof users.$inferSelect;

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export async function setupTwoFactor(db: Database, userId: string, email: string): Promise<TwoFactorSetup> {
  const secret = authenticator.generateSecret();
  await db.update(users).set({ totpSecret: secret }).where(eq(users.id, userId));

  const otpauthUrl = authenticator.keyuri(email, env.TOTP_ISSUER, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { secret, otpauthUrl, qrCodeDataUrl };
}

// Codes are displayed to the user as "XXXX-XXXX" but always hashed in this
// normalized form (no hyphen, uppercase) — both at issuance and at verify
// time — so the two hashes actually line up regardless of how the client
// re-submits the code (with or without the hyphen, any case).
function normalizeBackupCode(code: string): string {
  return code.trim().toUpperCase().replace(/-/g, '');
}

function hashBackupCode(normalizedCode: string): string {
  return createHash('sha256').update(normalizedCode).digest('hex');
}

export async function enableTwoFactor(db: Database, userId: string, totpCode: string): Promise<string[]> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.totpSecret) {
    throw badRequest('Call POST /v1/2fa/setup before enabling 2FA');
  }
  if (!authenticator.verify({ token: totpCode, secret: user.totpSecret })) {
    throw mfaInvalid();
  }

  const codes = generateBackupCodes(8);
  const hashed: BackupCodeHash[] = codes.map((code) => ({
    hash: hashBackupCode(normalizeBackupCode(code)),
    usedAt: null,
  }));
  await db.update(users).set({ is2faEnabled: true, backupCodesHash: hashed }).where(eq(users.id, userId));

  return codes;
}

export async function disableTwoFactor(
  db: Database,
  userId: string,
  password: string,
  totpCode: string,
): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw unauthorized();

  if (!(await verifyPassword(user.passwordHash, password))) {
    throw unauthorized('Incorrect password');
  }
  if (!user.totpSecret || !authenticator.verify({ token: totpCode, secret: user.totpSecret })) {
    throw mfaInvalid();
  }

  await db
    .update(users)
    .set({ is2faEnabled: false, totpSecret: null, backupCodesHash: [] })
    .where(eq(users.id, userId));
}

/** Verifies a 6-digit TOTP code OR an 8-char single-use backup code (consumed on match). */
export async function verifyTotpOrBackupCode(db: Database, user: UserRow, code: string): Promise<boolean> {
  const trimmed = code.trim();

  if (/^\d{6}$/.test(trimmed)) {
    return user.totpSecret ? authenticator.verify({ token: trimmed, secret: user.totpSecret }) : false;
  }

  const hash = hashBackupCode(normalizeBackupCode(trimmed));
  const match = user.backupCodesHash.find((entry) => entry.hash === hash && entry.usedAt === null);
  if (!match) return false;

  const updated = user.backupCodesHash.map((entry) =>
    entry.hash === hash ? { ...entry, usedAt: new Date().toISOString() } : entry,
  );
  await db.update(users).set({ backupCodesHash: updated }).where(eq(users.id, user.id));
  return true;
}
