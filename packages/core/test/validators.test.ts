import { describe, expect, it } from 'vitest';

import {
  isStrongPassword,
  isValidIFSC,
  isValidIndianPhone,
  isValidPAN,
  isValidPincode,
} from '../src/validators';

describe('isValidPAN', () => {
  it('accepts a well-formed PAN', () => {
    expect(isValidPAN('ABCDE1234F')).toBe(true);
  });

  it('rejects lowercase letters', () => {
    expect(isValidPAN('abcde1234f')).toBe(false);
  });

  it('rejects wrong letter/digit layout', () => {
    expect(isValidPAN('ABCD1234FF')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(isValidPAN('ABCDE123F')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidPAN('')).toBe(false);
  });
});

describe('isValidIFSC', () => {
  it('accepts a well-formed IFSC', () => {
    expect(isValidIFSC('HDFC0001234')).toBe(true);
  });

  it('rejects a missing literal zero in position 5', () => {
    expect(isValidIFSC('HDFC1001234')).toBe(false);
  });

  it('rejects lowercase', () => {
    expect(isValidIFSC('hdfc0001234')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(isValidIFSC('HDFC000123')).toBe(false);
  });
});

describe('isValidIndianPhone', () => {
  it('accepts a 10-digit number starting with 6', () => {
    expect(isValidIndianPhone('6123456789')).toBe(true);
  });

  it('accepts a 10-digit number starting with 9', () => {
    expect(isValidIndianPhone('9876543210')).toBe(true);
  });

  it('rejects a number starting with 5', () => {
    expect(isValidIndianPhone('5123456789')).toBe(false);
  });

  it('rejects a number with a country code prefix', () => {
    expect(isValidIndianPhone('919876543210')).toBe(false);
  });

  it('rejects fewer than 10 digits', () => {
    expect(isValidIndianPhone('987654321')).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(isValidIndianPhone('98765abcde')).toBe(false);
  });
});

describe('isValidPincode', () => {
  it('accepts a valid 6-digit pincode', () => {
    expect(isValidPincode('400001')).toBe(true);
  });

  it('rejects a pincode starting with 0', () => {
    expect(isValidPincode('012345')).toBe(false);
  });

  it('rejects fewer than 6 digits', () => {
    expect(isValidPincode('40001')).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(isValidPincode('40000A')).toBe(false);
  });
});

describe('isStrongPassword', () => {
  it('rejects a password shorter than the minimum length', () => {
    expect(isStrongPassword('Ab1!')).toBe(false);
  });

  it('rejects a password longer than the maximum length', () => {
    const tooLong = `Aa1!${'x'.repeat(70)}`;
    expect(isStrongPassword(tooLong)).toBe(false);
  });

  it('rejects a password missing complexity (no symbol)', () => {
    expect(isStrongPassword('Abcdefgh1')).toBe(false);
  });

  it('accepts a password meeting length and complexity requirements', () => {
    expect(isStrongPassword('Test@1234')).toBe(true);
  });

  it('rejects a password missing an uppercase letter', () => {
    expect(isStrongPassword('test@1234')).toBe(false);
  });

  it('rejects a password missing a digit', () => {
    expect(isStrongPassword('Test@word')).toBe(false);
  });
});
