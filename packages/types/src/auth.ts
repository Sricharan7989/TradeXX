import { INDIAN_PHONE_REGEX, STRONG_PASSWORD_REGEX } from '@tradex/core/validators';
import { z } from 'zod';


import { OTP_PURPOSE, SESSION_PLATFORM } from './enums';

export const emailSchema = z.string().trim().toLowerCase().email('Invalid email address');

export const phoneSchema = z
  .string()
  .trim()
  .regex(INDIAN_PHONE_REGEX, 'Invalid Indian mobile number');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(
    STRONG_PASSWORD_REGEX,
    'Password must include an uppercase letter, a lowercase letter, a digit, and a symbol',
  );

/** identifier is either an email or an Indian phone number. */
export const identifierSchema = z.union([emailSchema, phoneSchema]);

// ---- POST /v1/auth/signup ------------------------------------------------
export const signupSchema = z.object({
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

// ---- POST /v1/auth/verify-otp ---------------------------------------------
export const verifyOtpSchema = z.object({
  identifier: identifierSchema,
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must be numeric'),
  purpose: z.enum(OTP_PURPOSE),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

// ---- POST /v1/auth/resend-otp -----------------------------------------------
export const resendOtpSchema = z.object({
  identifier: identifierSchema,
  purpose: z.enum(OTP_PURPOSE),
});
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;

// ---- POST /v1/auth/login ----------------------------------------------------
export const deviceContextSchema = z.object({
  device_id: z.string().min(1).max(128),
  device_name: z.string().min(1).max(128).optional(),
  platform: z.enum(SESSION_PLATFORM),
});
export type DeviceContext = z.infer<typeof deviceContextSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  device: deviceContextSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const loginResponseSchema = z.union([
  z.object({
    mfa_required: z.literal(true),
    mfa_token: z.string(),
  }),
  z.object({
    mfa_required: z.literal(false),
    access_token: z.string(),
    expires_in: z.number(),
    user: z.object({
      id: z.string().uuid(),
      email: z.string(),
      status: z.string(),
    }),
  }),
]);
export type LoginResponse = z.infer<typeof loginResponseSchema>;

// ---- POST /v1/auth/login/2fa -------------------------------------------------
export const login2faSchema = z.object({
  mfa_token: z.string().min(1),
  // Either a 6-digit TOTP code, or an 8-char backup code in its display form
  // "XXXX-XXXX" (see packages/core/src/otp.ts generateBackupCodes) — the
  // hyphen is optional since callers may submit either form.
  totp_code: z
    .string()
    .regex(/^\d{6}$/, 'TOTP code must be 6 digits')
    .or(z.string().regex(/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i, 'Invalid backup code')),
  device: deviceContextSchema,
});
export type Login2faInput = z.infer<typeof login2faSchema>;

// ---- POST /v1/auth/refresh ---------------------------------------------------
export const refreshSchema = z.object({
  // Web sends the refresh token via httpOnly cookie (no body needed); mobile
  // has no cookie jar, so it sends the token explicitly.
  refresh_token: z.string().min(1).optional(),
  device_id: z.string().min(1).max(128).optional(),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

// ---- POST /v1/auth/logout -----------------------------------------------------
export const logoutSchema = z.object({
  refresh_token: z.string().min(1).optional(),
});
export type LogoutInput = z.infer<typeof logoutSchema>;

// ---- POST /v1/auth/forgot-password --------------------------------------------
export const forgotPasswordSchema = z.object({
  identifier: identifierSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ---- POST /v1/auth/reset-password ----------------------------------------------
export const resetPasswordSchema = z.object({
  identifier: identifierSchema,
  otp: z.string().length(6).regex(/^\d+$/),
  new_password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ---- GET /v1/auth/sessions / DELETE /v1/auth/sessions/:id -----------------------
export const sessionSchema = z.object({
  id: z.string().uuid(),
  device_id: z.string(),
  device_name: z.string().nullable(),
  platform: z.enum(SESSION_PLATFORM),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  is_current: z.boolean(),
  last_used_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  expires_at: z.string().datetime(),
});
export type SessionDto = z.infer<typeof sessionSchema>;

export const sessionsListResponseSchema = z.object({
  sessions: z.array(sessionSchema),
});
