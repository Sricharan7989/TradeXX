import { decryptField } from '@tradex/core';
import { type Database, userProfiles, userSettings, users } from '@tradex/db';
import type {
  DefaultProduct,
  KycStatus,
  MeResponse,
  Theme,
  TradingMode,
  UpdateSettingsInput,
  UserStatus,
} from '@tradex/types';
import { eq } from 'drizzle-orm';

import { encryptionKey } from '../../env';
import { notFound } from '../../lib/http-errors';

/** e.g. "ABCDE1234F" -> "AB*******F" — never return the plaintext PAN over the wire. */
function maskPan(pan: string): string {
  if (pan.length <= 3) return '*'.repeat(pan.length);
  return `${pan.slice(0, 2)}${'*'.repeat(pan.length - 3)}${pan.slice(-1)}`;
}

export async function getMe(db: Database, userId: string): Promise<MeResponse> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw notFound('User not found');

  const [profile, settings] = await Promise.all([
    db.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userId) }),
    db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) }),
  ]);

  return {
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      is_email_verified: user.isEmailVerified,
      is_phone_verified: user.isPhoneVerified,
      is_2fa_enabled: user.is2faEnabled,
      status: user.status as UserStatus,
      created_at: user.createdAt.toISOString(),
    },
    profile: profile
      ? {
          full_name: profile.fullName,
          date_of_birth: profile.dateOfBirth,
          pan_masked: profile.pan ? maskPan(decryptField(profile.pan, encryptionKey)) : null,
          aadhaar_last4: profile.aadhaarLast4,
          address_line1: profile.addressLine1,
          address_line2: profile.addressLine2,
          city: profile.city,
          state: profile.state,
          pincode: profile.pincode,
          dp_id: profile.dpId,
          demat_account_number: profile.dematAccountNumber,
          kyc_status: profile.kycStatus as KycStatus,
          kyc_rejection_reason: profile.kycRejectionReason,
        }
      : null,
    settings: settings
      ? {
          trading_mode: settings.tradingMode as TradingMode,
          theme: settings.theme as Theme,
          default_product: settings.defaultProduct as DefaultProduct,
          order_confirmation_required: settings.orderConfirmationRequired,
        }
      : // Defensive fallback — a settings row is always created at signup, so
        // this only matters if that invariant is ever broken.
        { trading_mode: 'PAPER', theme: 'DARK', default_product: 'CNC', order_confirmation_required: true },
  };
}

export async function updateSettings(db: Database, userId: string, input: UpdateSettingsInput): Promise<void> {
  const patch: Partial<typeof userSettings.$inferInsert> = {};
  if (input.trading_mode !== undefined) patch.tradingMode = input.trading_mode;
  if (input.theme !== undefined) patch.theme = input.theme;
  if (input.default_product !== undefined) patch.defaultProduct = input.default_product;
  if (input.order_confirmation_required !== undefined) {
    patch.orderConfirmationRequired = input.order_confirmation_required;
  }

  await db
    .insert(userSettings)
    .values({ userId, ...patch })
    .onConflictDoUpdate({ target: userSettings.userId, set: patch });
}
