import { IFSC_REGEX, PAN_REGEX, PINCODE_REGEX } from '@tradex/core/validators';
import { z } from 'zod';


import { KYC_STATUS } from './enums';

// ---- POST /v1/kyc/submit -------------------------------------------------------
export const kycSubmitSchema = z.object({
  full_name: z.string().trim().min(2).max(140),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date_of_birth must be YYYY-MM-DD')
    .refine((dob) => {
      const age = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return age >= 18 && age <= 120;
    }, 'You must be at least 18 years old'),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(PAN_REGEX, 'Invalid PAN format (e.g. ABCDE1234F)'),
  aadhaar_last4: z.string().regex(/^\d{4}$/, 'aadhaar_last4 must be exactly 4 digits'),
  address_line1: z.string().trim().min(3).max(200),
  address_line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pincode: z.string().trim().regex(PINCODE_REGEX, 'Invalid Indian pincode'),
  bank_account_number: z
    .string()
    .trim()
    .regex(/^\d{9,18}$/, 'bank_account_number must be 9–18 digits'),
  bank_ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(IFSC_REGEX, 'Invalid IFSC format (e.g. HDFC0001234)'),
  dp_id: z.string().trim().min(1).max(50).optional(),
  demat_account_number: z.string().trim().min(1).max(50).optional(),
});
export type KycSubmitInput = z.infer<typeof kycSubmitSchema>;

// ---- GET /v1/kyc/status ---------------------------------------------------------
export const kycStatusResponseSchema = z.object({
  kyc_status: z.enum(KYC_STATUS),
  kyc_rejection_reason: z.string().nullable(),
  submitted_at: z.string().datetime().nullable(),
});
export type KycStatusResponse = z.infer<typeof kycStatusResponseSchema>;

// ---- POST /v1/kyc/upload ---------------------------------------------------------
// Presigned-URL stub: for Phase 1 this returns a local-disk upload target the
// client PUTs the file to directly; swapped for S3/GCS presigned POST later.
export const kycUploadRequestSchema = z.object({
  doc_type: z.enum(['PAN_CARD', 'AADHAAR_FRONT', 'AADHAAR_BACK', 'BANK_PROOF', 'PHOTO']),
  file_name: z.string().min(1).max(255),
  content_type: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
});
export type KycUploadRequest = z.infer<typeof kycUploadRequestSchema>;

export const kycUploadResponseSchema = z.object({
  upload_url: z.string(),
  document_id: z.string().uuid(),
  expires_at: z.string().datetime(),
});
export type KycUploadResponse = z.infer<typeof kycUploadResponseSchema>;
