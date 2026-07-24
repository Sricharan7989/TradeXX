/**
 * Shared validation regexes and predicates for Indian-market identity/finance
 * fields. Consumed directly by packages/types' Zod schemas so validation
 * logic has exactly one source of truth between the API, web, and mobile.
 */

/** PAN: 5 letters, 4 digits, 1 letter — e.g. ABCDE1234F. */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** IFSC: 4 letters, literal "0", 6 alphanumeric — e.g. HDFC0001234. */
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** Indian mobile number: 10 digits, first digit 6–9 (no country code). */
export const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/;

/** Indian PIN code: 6 digits, first digit non-zero. */
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

/**
 * At least one lowercase letter, one uppercase letter, one digit, and one
 * symbol. Length is enforced separately (see isStrongPassword / the Zod
 * schema in packages/types) since regex length checks are harder to read.
 */
export const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // argon2/bcrypt-safe upper bound

export function isValidPAN(value: string): boolean {
  return PAN_REGEX.test(value);
}

export function isValidIFSC(value: string): boolean {
  return IFSC_REGEX.test(value);
}

export function isValidIndianPhone(value: string): boolean {
  return INDIAN_PHONE_REGEX.test(value);
}

export function isValidPincode(value: string): boolean {
  return PINCODE_REGEX.test(value);
}

export function isStrongPassword(value: string): boolean {
  return (
    value.length >= PASSWORD_MIN_LENGTH &&
    value.length <= PASSWORD_MAX_LENGTH &&
    STRONG_PASSWORD_REGEX.test(value)
  );
}
