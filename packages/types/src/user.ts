import { z } from 'zod';

import { DEFAULT_PRODUCT, KYC_STATUS, THEME, TRADING_MODE, USER_STATUS } from './enums';

export const userDto = z.object({
  id: z.string().uuid(),
  email: z.string(),
  phone: z.string(),
  is_email_verified: z.boolean(),
  is_phone_verified: z.boolean(),
  is_2fa_enabled: z.boolean(),
  status: z.enum(USER_STATUS),
  created_at: z.string().datetime(),
});
export type UserDto = z.infer<typeof userDto>;

export const userProfileDto = z.object({
  full_name: z.string().nullable(),
  date_of_birth: z.string().nullable(),
  pan_masked: z.string().nullable(), // e.g. "AB***1234F" — never return plaintext PAN
  aadhaar_last4: z.string().nullable(),
  address_line1: z.string().nullable(),
  address_line2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pincode: z.string().nullable(),
  dp_id: z.string().nullable(),
  demat_account_number: z.string().nullable(),
  kyc_status: z.enum(KYC_STATUS),
  kyc_rejection_reason: z.string().nullable(),
});
export type UserProfileDto = z.infer<typeof userProfileDto>;

export const userSettingsDto = z.object({
  trading_mode: z.enum(TRADING_MODE),
  theme: z.enum(THEME),
  default_product: z.enum(DEFAULT_PRODUCT),
  order_confirmation_required: z.boolean(),
});
export type UserSettingsDto = z.infer<typeof userSettingsDto>;

// ---- GET /v1/me ---------------------------------------------------------------
export const meResponseSchema = z.object({
  user: userDto,
  profile: userProfileDto.nullable(),
  settings: userSettingsDto,
});
export type MeResponse = z.infer<typeof meResponseSchema>;

// ---- PATCH /v1/me/settings -----------------------------------------------------
export const updateSettingsSchema = z
  .object({
    trading_mode: z.enum(TRADING_MODE),
    theme: z.enum(THEME),
    default_product: z.enum(DEFAULT_PRODUCT),
    order_confirmation_required: z.boolean(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one setting must be provided',
  });
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
