// Enum value lists — single source of truth shared by packages/db (pgEnum),
// the API (Zod validation), and the web/mobile clients. Keep these arrays in
// sync with the DB schema; packages/db imports directly from here.

export const USER_STATUS = ['PENDING_KYC', 'ACTIVE', 'SUSPENDED', 'CLOSED'] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const KYC_STATUS = ['NOT_STARTED', 'SUBMITTED', 'VERIFIED', 'REJECTED'] as const;
export type KycStatus = (typeof KYC_STATUS)[number];

export const TRADING_MODE = ['PAPER', 'LIVE'] as const;
export type TradingMode = (typeof TRADING_MODE)[number];

export const DEFAULT_PRODUCT = ['CNC', 'MIS', 'NRML'] as const;
export type DefaultProduct = (typeof DEFAULT_PRODUCT)[number];

export const THEME = ['DARK', 'LIGHT', 'SYSTEM'] as const;
export type Theme = (typeof THEME)[number];

// PAPER is always available; the others are real brokers wired up in a later phase.
export const BROKER_PROVIDER = ['PAPER', 'KITE', 'UPSTOX', 'ANGEL_ONE'] as const;
export type BrokerProvider = (typeof BROKER_PROVIDER)[number];

export const SESSION_PLATFORM = ['WEB', 'IOS', 'ANDROID'] as const;
export type SessionPlatform = (typeof SESSION_PLATFORM)[number];

export const OTP_PURPOSE = ['SIGNUP', 'LOGIN', 'RESET_PASSWORD', 'PHONE_VERIFY'] as const;
export type OtpPurpose = (typeof OTP_PURPOSE)[number];
