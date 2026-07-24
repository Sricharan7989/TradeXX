import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { decryptField, encryptField, hashForLookup, parseEncryptionKey } from '../src/crypto';

const testKey = randomBytes(32);

describe('parseEncryptionKey', () => {
  it('parses a valid 64-char hex key into a 32-byte Buffer', () => {
    const hex = testKey.toString('hex');
    const parsed = parseEncryptionKey(hex);
    expect(parsed.length).toBe(32);
    expect(parsed.equals(testKey)).toBe(true);
  });

  it('throws when the key is the wrong length', () => {
    expect(() => parseEncryptionKey('deadbeef')).toThrow(/32 bytes/);
  });
});

describe('encryptField / decryptField', () => {
  it('round-trips a plaintext string', () => {
    const plaintext = 'ABCDE1234F'; // e.g. a PAN
    const ciphertext = encryptField(plaintext, testKey);
    expect(decryptField(ciphertext, testKey)).toBe(plaintext);
  });

  it('round-trips an empty string', () => {
    const ciphertext = encryptField('', testKey);
    expect(decryptField(ciphertext, testKey)).toBe('');
  });

  it('round-trips unicode content', () => {
    const plaintext = '₹ रुपया — बैंक खाता 1234567890';
    const ciphertext = encryptField(plaintext, testKey);
    expect(decryptField(ciphertext, testKey)).toBe(plaintext);
  });

  it('produces a different ciphertext each call for the same plaintext (random IV)', () => {
    const a = encryptField('same-plaintext', testKey);
    const b = encryptField('same-plaintext', testKey);
    expect(a).not.toBe(b);
  });

  it('fails to decrypt with the wrong key', () => {
    const ciphertext = encryptField('secret', testKey);
    const wrongKey = randomBytes(32);
    expect(() => decryptField(ciphertext, wrongKey)).toThrow();
  });

  it('fails to decrypt tampered ciphertext (auth tag mismatch)', () => {
    const ciphertext = encryptField('secret', testKey);
    const raw = Buffer.from(ciphertext, 'base64');
    raw[raw.length - 1] = (raw[raw.length - 1] ?? 0) ^ 0xff; // flip last byte
    const tampered = raw.toString('base64');
    expect(() => decryptField(tampered, testKey)).toThrow();
  });
});

describe('hashForLookup', () => {
  it('is deterministic for the same value and key', () => {
    expect(hashForLookup('ABCDE1234F', testKey)).toBe(hashForLookup('ABCDE1234F', testKey));
  });

  it('differs for different values', () => {
    expect(hashForLookup('ABCDE1234F', testKey)).not.toBe(hashForLookup('ZZZZZ9999Z', testKey));
  });

  it('differs for different keys', () => {
    expect(hashForLookup('ABCDE1234F', testKey)).not.toBe(
      hashForLookup('ABCDE1234F', randomBytes(32)),
    );
  });

  it('returns a 64-char hex string (SHA-256 digest)', () => {
    expect(hashForLookup('ABCDE1234F', testKey)).toMatch(/^[0-9a-f]{64}$/);
  });
});
