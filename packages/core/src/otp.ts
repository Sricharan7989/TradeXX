/**
 * OTP generation and constant-time verification for signup / login / password
 * reset / phone-verify flows. OTPs are hashed (HMAC-SHA256 with a server
 * pepper) before being stored in otp_verifications — never persisted in
 * plaintext.
 */
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

const BACKUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const BACKUP_CODE_LENGTH = 8;

/** Generates a numeric OTP of the given length (default 6 digits), zero-padded. */
export function generateOtp(length = 6): string {
  if (length < 4 || length > 10) {
    throw new Error(`generateOtp: length must be between 4 and 10, got ${length}`);
  }
  const max = 10 ** length;
  return randomInt(0, max).toString().padStart(length, '0');
}

/** HMAC-SHA256 hash of an OTP using a server-side pepper. */
export function hashOtp(otp: string, pepper: string): string {
  return createHmac('sha256', pepper).update(otp).digest('hex');
}

/** Constant-time comparison of a candidate OTP against its stored hash. */
export function verifyOtp(candidateOtp: string, storedHash: string, pepper: string): boolean {
  const candidate = Buffer.from(hashOtp(candidateOtp, pepper), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/** Generates a single human-typeable backup code, e.g. "K7QF-9X2M". */
function generateBackupCode(): string {
  let code = '';
  for (let i = 0; i < BACKUP_CODE_LENGTH; i++) {
    code += BACKUP_CODE_ALPHABET.charAt(randomInt(0, BACKUP_CODE_ALPHABET.length));
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Generates `count` unique single-use 2FA backup codes (default 8, per spec). */
export function generateBackupCodes(count = 8): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(generateBackupCode());
  }
  return [...codes];
}
