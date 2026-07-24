import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import { encryptField, hashForLookup } from '@tradex/core';
import { type Database, userProfiles } from '@tradex/db';
import type { KycStatusResponse, KycSubmitInput } from '@tradex/types';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { encryptionKey, uploadDir } from '../../env';
import { conflict } from '../../lib/http-errors';

export async function submitKyc(db: Database, userId: string, input: KycSubmitInput): Promise<void> {
  const panHash = hashForLookup(input.pan, encryptionKey);

  const existingWithPan = await db.query.userProfiles.findFirst({ where: eq(userProfiles.panHash, panHash) });
  if (existingWithPan && existingWithPan.userId !== userId) {
    throw conflict('This PAN is already associated with another account');
  }

  const values = {
    userId,
    fullName: input.full_name,
    dateOfBirth: input.date_of_birth,
    pan: encryptField(input.pan, encryptionKey),
    panHash,
    aadhaarLast4: input.aadhaar_last4,
    addressLine1: input.address_line1,
    addressLine2: input.address_line2 ?? null,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
    bankAccountNumber: encryptField(input.bank_account_number, encryptionKey),
    bankIfsc: input.bank_ifsc,
    dpId: input.dp_id ?? null,
    dematAccountNumber: input.demat_account_number ?? null,
    kycStatus: 'SUBMITTED' as const,
    kycRejectionReason: null,
  };

  await db.insert(userProfiles).values(values).onConflictDoUpdate({ target: userProfiles.userId, set: values });
}

export async function getKycStatus(db: Database, userId: string): Promise<KycStatusResponse> {
  const profile = await db.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userId) });
  if (!profile) {
    return { kyc_status: 'NOT_STARTED', kyc_rejection_reason: null, submitted_at: null };
  }
  return {
    kyc_status: profile.kycStatus as KycStatusResponse['kyc_status'],
    kyc_rejection_reason: profile.kycRejectionReason,
    submitted_at: profile.kycStatus === 'NOT_STARTED' ? null : profile.updatedAt.toISOString(),
  };
}

const UPLOAD_URL_TTL_MINUTES = 15;

export interface UploadTarget {
  documentId: string;
  uploadUrl: string;
  expiresAt: string;
}

/**
 * Presigned-URL stub (local disk for now, per spec): in a later phase this
 * returns a real S3/GCS presigned PUT URL; for Phase 1 it returns a path on
 * this same API server that PUT /v1/kyc/upload/:documentId serves.
 */
export function createUploadTarget(): UploadTarget {
  const documentId = uuidv7();
  return {
    documentId,
    uploadUrl: `/v1/kyc/upload/${documentId}`,
    expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_MINUTES * 60_000).toISOString(),
  };
}

export async function writeUploadedFile(documentId: string, stream: NodeJS.ReadableStream): Promise<void> {
  await mkdir(uploadDir, { recursive: true });
  const destPath = path.join(uploadDir, documentId);
  await pipeline(stream, createWriteStream(destPath));
}
