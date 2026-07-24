import { describe, expect, it } from 'vitest';

import { generateBackupCodes, generateOtp, hashOtp, verifyOtp } from '../src/otp';

const pepper = 'test-pepper-not-for-production';

describe('generateOtp', () => {
  it('generates a 6-digit numeric string by default', () => {
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it('generates a numeric string of the requested length', () => {
    const otp = generateOtp(4);
    expect(otp).toMatch(/^\d{4}$/);
  });

  it('zero-pads short random values to the full length', () => {
    // Run many times; statistically at least one should need left-padding.
    const otps = Array.from({ length: 200 }, () => generateOtp(4));
    expect(otps.some((otp) => otp.startsWith('0'))).toBe(true);
  });

  it('throws when length is too short', () => {
    expect(() => generateOtp(3)).toThrow(/between 4 and 10/);
  });

  it('throws when length is too long', () => {
    expect(() => generateOtp(11)).toThrow(/between 4 and 10/);
  });
});

describe('hashOtp / verifyOtp', () => {
  it('verifies a matching OTP', () => {
    const otp = '123456';
    const hash = hashOtp(otp, pepper);
    expect(verifyOtp(otp, hash, pepper)).toBe(true);
  });

  it('rejects a non-matching OTP', () => {
    const hash = hashOtp('123456', pepper);
    expect(verifyOtp('654321', hash, pepper)).toBe(false);
  });

  it('rejects when the pepper differs', () => {
    const hash = hashOtp('123456', pepper);
    expect(verifyOtp('123456', hash, 'different-pepper')).toBe(false);
  });

  it('rejects a malformed/short hash without throwing', () => {
    expect(verifyOtp('123456', 'not-a-real-hash', pepper)).toBe(false);
  });
});

describe('generateBackupCodes', () => {
  it('generates 8 codes by default, per spec', () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(8);
  });

  it('generates unique codes in the expected XXXX-XXXX shape', () => {
    const codes = generateBackupCodes(8);
    expect(new Set(codes).size).toBe(8);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    }
  });

  it('supports a custom count', () => {
    expect(generateBackupCodes(3)).toHaveLength(3);
  });
});
