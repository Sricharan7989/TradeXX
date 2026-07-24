import { z } from 'zod';

// ---- POST /v1/2fa/setup -----------------------------------------------------
// No input beyond auth. Returns a fresh TOTP secret + otpauth:// URI + QR data URL.
export const twoFaSetupResponseSchema = z.object({
  secret: z.string(),
  otpauth_url: z.string(),
  qr_code_data_url: z.string(),
});
export type TwoFaSetupResponse = z.infer<typeof twoFaSetupResponseSchema>;

// ---- POST /v1/2fa/enable ----------------------------------------------------
export const twoFaEnableSchema = z.object({
  totp_code: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
});
export type TwoFaEnableInput = z.infer<typeof twoFaEnableSchema>;

export const twoFaEnableResponseSchema = z.object({
  backup_codes: z.array(z.string()).length(8),
});
export type TwoFaEnableResponse = z.infer<typeof twoFaEnableResponseSchema>;

// ---- POST /v1/2fa/disable ----------------------------------------------------
export const twoFaDisableSchema = z.object({
  password: z.string().min(1),
  totp_code: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
});
export type TwoFaDisableInput = z.infer<typeof twoFaDisableSchema>;
