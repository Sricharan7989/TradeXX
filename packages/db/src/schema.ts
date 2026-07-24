/**
 * Drizzle schema — packages/db/src/schema.ts
 *
 * IDs: UUID v7 (time-sortable), generated in application code via the
 * `uuidv7` package ($defaultFn) — Postgres 16 has no native uuidv7() yet.
 *
 * Timestamps: every timestamp column is `timestamptz`, always written/read
 * as UTC. Render in IST at the edges (web/mobile), never in the DB layer.
 *
 * Encryption: `pan` and `bank_account_number` are AES-256-GCM ciphertext
 * (packages/core/src/crypto.ts), written by the application layer — this
 * schema only knows them as opaque `text`. Because GCM uses a random IV per
 * encryption, the same plaintext PAN never produces the same ciphertext
 * twice, so a UNIQUE constraint on the ciphertext column can't enforce "one
 * account per PAN" the way the spec requires. To satisfy uniqueness AND
 * encryption-at-rest simultaneously, `pan_hash` stores a deterministic
 * HMAC-SHA256 of the PAN (keyed by a server-side pepper, never the raw
 * value) purely for uniqueness/lookup; `pan` stores the recoverable
 * ciphertext. Same pattern is available for other fields if a future phase
 * needs to look up by an encrypted value.
 */
import {
  BROKER_PROVIDER,
  DEFAULT_PRODUCT,
  KYC_STATUS,
  OTP_PURPOSE,
  SESSION_PLATFORM,
  THEME,
  TRADING_MODE,
  USER_STATUS,
} from '@tradex/types';
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';


// ---------------------------------------------------------------------------
// Custom types
// ---------------------------------------------------------------------------

/** Case-insensitive text (Postgres `citext` extension — enabled in the first migration). */
const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'citext';
  },
});

// ---------------------------------------------------------------------------
// Enums (single source of truth: packages/types/src/enums.ts)
// ---------------------------------------------------------------------------

export const userStatusEnum = pgEnum('user_status', [...USER_STATUS] as [string, ...string[]]);
export const kycStatusEnum = pgEnum('kyc_status', [...KYC_STATUS] as [string, ...string[]]);
export const tradingModeEnum = pgEnum('trading_mode', [...TRADING_MODE] as [string, ...string[]]);
export const defaultProductEnum = pgEnum('default_product', [
  ...DEFAULT_PRODUCT,
] as [string, ...string[]]);
export const themeEnum = pgEnum('theme', [...THEME] as [string, ...string[]]);
export const brokerProviderEnum = pgEnum('broker_provider', [
  ...BROKER_PROVIDER,
] as [string, ...string[]]);
export const sessionPlatformEnum = pgEnum('session_platform', [
  ...SESSION_PLATFORM,
] as [string, ...string[]]);
export const otpPurposeEnum = pgEnum('otp_purpose', [...OTP_PURPOSE] as [string, ...string[]]);

// ---------------------------------------------------------------------------
// Shared column helpers
// ---------------------------------------------------------------------------

const id = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7());

const createdAt = () => timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull();

const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

/**
 * Not in the original spec's literal table list, but required to make the
 * explicitly-specified `POST /v1/2fa/enable` endpoint ("...return 8
 * single-use backup codes") actually functional — the codes have to be
 * persisted somewhere to be verifiable and single-use later. Storing a
 * SHA-256 hash per code (never the code itself) on the user row was the
 * smallest addition that satisfies both the DB schema (no new table) and
 * the endpoint contract.
 */
export interface BackupCodeHash {
  hash: string;
  usedAt: string | null;
}

export const users = pgTable('users', {
  id: id(),
  email: citext('email').notNull(),
  phone: text('phone').notNull(),
  passwordHash: text('password_hash').notNull(),
  isEmailVerified: boolean('is_email_verified').default(false).notNull(),
  isPhoneVerified: boolean('is_phone_verified').default(false).notNull(),
  totpSecret: text('totp_secret'),
  is2faEnabled: boolean('is_2fa_enabled').default(false).notNull(),
  backupCodesHash: jsonb('backup_codes_hash').$type<BackupCodeHash[]>().default(sql`'[]'::jsonb`).notNull(),
  status: userStatusEnum('status').default('PENDING_KYC').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('users_email_unique').on(table.email),
  uniqueIndex('users_phone_unique').on(table.phone),
]);

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, { fields: [users.id], references: [userProfiles.userId] }),
  settings: one(userSettings, { fields: [users.id], references: [userSettings.userId] }),
  brokerConnections: many(brokerConnections),
  sessions: many(sessions),
  auditLogs: many(auditLog),
  otpVerifications: many(otpVerifications),
}));

// ---------------------------------------------------------------------------
// user_profiles
// ---------------------------------------------------------------------------

export const userProfiles = pgTable('user_profiles', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  fullName: text('full_name'),
  dateOfBirth: date('date_of_birth', { mode: 'string' }),
  /** AES-256-GCM ciphertext — see module docstring. */
  pan: text('pan'),
  /** HMAC-SHA256(pan) for uniqueness/lookup only — never decrypted, never displayed. */
  panHash: text('pan_hash'),
  aadhaarLast4: text('aadhaar_last4'),
  addressLine1: text('address_line1'),
  addressLine2: text('address_line2'),
  city: text('city'),
  state: text('state'),
  pincode: text('pincode'),
  /** AES-256-GCM ciphertext — see module docstring. */
  bankAccountNumber: text('bank_account_number'),
  bankIfsc: text('bank_ifsc'),
  dpId: text('dp_id'),
  dematAccountNumber: text('demat_account_number'),
  kycStatus: kycStatusEnum('kyc_status').default('NOT_STARTED').notNull(),
  kycRejectionReason: text('kyc_rejection_reason'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('user_profiles_user_id_unique').on(table.userId),
  uniqueIndex('user_profiles_pan_hash_unique').on(table.panHash),
]);

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, { fields: [userProfiles.userId], references: [users.id] }),
}));

// ---------------------------------------------------------------------------
// user_settings
// ---------------------------------------------------------------------------

export const userSettings = pgTable('user_settings', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tradingMode: tradingModeEnum('trading_mode').default('PAPER').notNull(),
  theme: themeEnum('theme').default('DARK').notNull(),
  defaultProduct: defaultProductEnum('default_product').default('CNC').notNull(),
  orderConfirmationRequired: boolean('order_confirmation_required').default(true).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [uniqueIndex('user_settings_user_id_unique').on(table.userId)]);

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, { fields: [userSettings.userId], references: [users.id] }),
}));

// ---------------------------------------------------------------------------
// broker_connections (populated later; defined now)
// ---------------------------------------------------------------------------

export const brokerConnections = pgTable('broker_connections', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: brokerProviderEnum('provider').notNull(),
  apiKey: text('api_key'),
  /** AES-256-GCM ciphertext. */
  accessTokenEncrypted: text('access_token_encrypted'),
  /** AES-256-GCM ciphertext. */
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true, mode: 'date' }),
  isActive: boolean('is_active').default(false).notNull(),
  connectedAt: timestamp('connected_at', { withTimezone: true, mode: 'date' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('broker_connections_user_provider_unique').on(table.userId, table.provider),
]);

export const brokerConnectionsRelations = relations(brokerConnections, ({ one }) => ({
  user: one(users, { fields: [brokerConnections.userId], references: [users.id] }),
}));

// ---------------------------------------------------------------------------
// sessions
// ---------------------------------------------------------------------------

export const sessions = pgTable('sessions', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** SHA-256 hash of the rotating refresh token — the raw token is never stored. */
  refreshTokenHash: text('refresh_token_hash').notNull(),
  deviceId: text('device_id').notNull(),
  deviceName: text('device_name'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  platform: sessionPlatformEnum('platform').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
  createdAt: createdAt(),
}, (table) => [
  index('sessions_user_id_idx').on(table.userId),
  uniqueIndex('sessions_refresh_token_hash_unique').on(table.refreshTokenHash),
]);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

// ---------------------------------------------------------------------------
// audit_log
// ---------------------------------------------------------------------------

export const auditLog = pgTable('audit_log', {
  id: id(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`).notNull(),
  ipAddress: text('ip_address'),
  createdAt: createdAt(),
}, (table) => [
  index('audit_log_user_id_created_at_idx').on(table.userId, table.createdAt.desc()),
]);

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, { fields: [auditLog.userId], references: [users.id] }),
}));

// ---------------------------------------------------------------------------
// otp_verifications
// ---------------------------------------------------------------------------

export const otpVerifications = pgTable('otp_verifications', {
  id: id(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  identifier: text('identifier').notNull(),
  otpHash: text('otp_hash').notNull(),
  purpose: otpPurposeEnum('purpose').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true, mode: 'date' }),
  createdAt: createdAt(),
}, (table) => [
  index('otp_verifications_identifier_purpose_idx').on(table.identifier, table.purpose),
]);

export const otpVerificationsRelations = relations(otpVerifications, ({ one }) => ({
  user: one(users, { fields: [otpVerifications.userId], references: [users.id] }),
}));
