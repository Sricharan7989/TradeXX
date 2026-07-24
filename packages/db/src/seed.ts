/**
 * pnpm db:seed — creates 3 users for local development / integration tests,
 * per spec: verified+2FA, verified no-2FA, and pending-KYC. All share the
 * password `Test@1234`.
 */
import { encryptField, hashForLookup, hashPassword, parseEncryptionKey } from '@tradex/core';
import { authenticator } from 'otplib';

// './index' -> './client' loads the repo-root .env as part of its own
// module evaluation (see client.ts), so DATABASE_URL/ENCRYPTION_KEY are
// already populated by the time this file's top-level code runs.
import { db, queryClient, userProfiles, users, userSettings } from './index';

const SEED_PASSWORD = 'Test@1234';

async function main(): Promise<void> {
  const encryptionKeyHex = process.env.ENCRYPTION_KEY;
  if (!encryptionKeyHex) {
    throw new Error('seed.ts: ENCRYPTION_KEY is not set');
  }
  const encryptionKey = parseEncryptionKey(encryptionKeyHex);
  const passwordHash = await hashPassword(SEED_PASSWORD);

  console.log('Seeding database...');

  // ---- User 1: verified, 2FA enabled, KYC verified ---------------------------
  const totpSecret = authenticator.generateSecret();
  const [userWith2fa] = await db
    .insert(users)
    .values({
      email: 'verified.2fa@tradex.dev',
      phone: '9876543210',
      passwordHash,
      isEmailVerified: true,
      isPhoneVerified: true,
      totpSecret,
      is2faEnabled: true,
      status: 'ACTIVE',
    })
    .onConflictDoNothing()
    .returning();

  // ---- User 2: verified, no 2FA, KYC verified ---------------------------------
  const [userNo2fa] = await db
    .insert(users)
    .values({
      email: 'verified.no2fa@tradex.dev',
      phone: '9876543211',
      passwordHash,
      isEmailVerified: true,
      isPhoneVerified: true,
      is2faEnabled: false,
      status: 'ACTIVE',
    })
    .onConflictDoNothing()
    .returning();

  // ---- User 3: pending KYC ------------------------------------------------------
  const [userPendingKyc] = await db
    .insert(users)
    .values({
      email: 'pending.kyc@tradex.dev',
      phone: '9876543212',
      passwordHash,
      isEmailVerified: true,
      isPhoneVerified: false,
      is2faEnabled: false,
      status: 'PENDING_KYC',
    })
    .onConflictDoNothing()
    .returning();

  const seededUsers = [userWith2fa, userNo2fa, userPendingKyc].filter(Boolean);
  if (seededUsers.length === 0) {
    console.log('Seed users already exist — skipping profile/settings insert.');
    await queryClient.end();
    return;
  }

  // Settings for every seeded user.
  for (const user of seededUsers) {
    if (!user) continue;
    await db.insert(userSettings).values({ userId: user.id }).onConflictDoNothing();
  }

  // Verified KYC profiles for the two ACTIVE users.
  const verifiedProfiles: Array<{
    user: typeof userWith2fa;
    fullName: string;
    dob: string;
    pan: string;
    aadhaarLast4: string;
    bankAccountNumber: string;
    bankIfsc: string;
  }> = [
    {
      user: userWith2fa,
      fullName: 'Aarav Sharma',
      dob: '1990-05-14',
      pan: 'ABCDE1234F',
      aadhaarLast4: '1234',
      bankAccountNumber: '123456789012',
      bankIfsc: 'HDFC0001234',
    },
    {
      user: userNo2fa,
      fullName: 'Priya Iyer',
      dob: '1994-11-02',
      pan: 'FGHIJ5678K',
      aadhaarLast4: '5678',
      bankAccountNumber: '987654321098',
      bankIfsc: 'ICIC0005678',
    },
  ];

  for (const profile of verifiedProfiles) {
    if (!profile.user) continue;
    await db
      .insert(userProfiles)
      .values({
        userId: profile.user.id,
        fullName: profile.fullName,
        dateOfBirth: profile.dob,
        pan: encryptField(profile.pan, encryptionKey),
        panHash: hashForLookup(profile.pan, encryptionKey),
        aadhaarLast4: profile.aadhaarLast4,
        addressLine1: '221B, MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        bankAccountNumber: encryptField(profile.bankAccountNumber, encryptionKey),
        bankIfsc: profile.bankIfsc,
        dpId: 'IN300123',
        dematAccountNumber: '10012345678',
        kycStatus: 'VERIFIED',
      })
      .onConflictDoNothing();
  }

  console.log('Seed complete:');
  console.log('  verified.2fa@tradex.dev      (2FA enabled, KYC verified)');
  console.log(`    TOTP secret: ${totpSecret}`);
  console.log('  verified.no2fa@tradex.dev    (no 2FA, KYC verified)');
  console.log('  pending.kyc@tradex.dev       (KYC not started)');
  console.log(`  password for all: ${SEED_PASSWORD}`);

  await queryClient.end();
}

main().catch((error: unknown) => {
  console.error('Seeding failed:', error);
  process.exitCode = 1;
});
