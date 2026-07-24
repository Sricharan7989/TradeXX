/**
 * Field-level encryption at rest (AES-256-GCM) for PAN, bank account numbers,
 * and broker tokens. This module stays pure/zero-I/O: it takes the key as a
 * Buffer argument rather than reading `process.env.ENCRYPTION_KEY` itself —
 * the API layer reads that env var once at startup via `parseEncryptionKey`
 * and threads the resulting key through.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH_BYTES = 32; // AES-256
const IV_LENGTH_BYTES = 12; // 96-bit nonce, recommended for GCM
const AUTH_TAG_LENGTH_BYTES = 16;

/**
 * Parses the hex-encoded ENCRYPTION_KEY env value into the 32-byte Buffer
 * AES-256-GCM requires. Throws if the key is the wrong length — fail fast at
 * startup rather than at the first encrypt/decrypt call.
 */
export function parseEncryptionKey(hexKey: string): Buffer {
  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `parseEncryptionKey: ENCRYPTION_KEY must decode to exactly ${KEY_LENGTH_BYTES} bytes (${KEY_LENGTH_BYTES * 2} hex chars) for AES-256-GCM, got ${key.length} bytes`,
    );
  }
  return key;
}

/**
 * Encrypts a UTF-8 string field, returning a single base64 payload packing
 * `iv || authTag || ciphertext` — safe to store in one TEXT/VARCHAR column.
 * A fresh random IV is generated per call, so the same plaintext never
 * produces the same ciphertext twice.
 */
export function encryptField(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/**
 * Decrypts a payload produced by `encryptField`. Throws if the payload was
 * tampered with (GCM auth tag mismatch) or the key is wrong.
 */
export function decryptField(payload: string, key: Buffer): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, IV_LENGTH_BYTES);
  const authTag = raw.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
  const ciphertext = raw.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

/**
 * Deterministic HMAC-SHA256 of a value, keyed by the same 32-byte key used
 * for field encryption. Used only where a `UNIQUE`/lookup constraint must be
 * enforced on an otherwise-encrypted column (e.g. `user_profiles.pan_hash`)
 * — AES-GCM ciphertext is intentionally non-deterministic (random IV per
 * call), so it can never itself back a uniqueness check. Never used to
 * recover the original value, only to compare it.
 */
export function hashForLookup(value: string, key: Buffer): string {
  return createHmac('sha256', key).update(value).digest('hex');
}
