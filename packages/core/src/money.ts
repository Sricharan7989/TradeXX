/**
 * All money in Tradex is represented as bigint paise (₹1 = 100 paise).
 * Never use `number`/`float` for currency — floating point cannot represent
 * decimal fractions exactly and silently corrupts financial calculations.
 * Every price/amount column in the DB is BIGINT paise; these are the only
 * sanctioned functions for converting to/from and operating on that value.
 */

/** Money is always paise, always a bigint. Aliased for call-site clarity. */
export type Paise = bigint;

const RUPEE_AMOUNT_PATTERN = /^-?\d+(\.\d{1,2})?$/;
const INR_SYMBOL = '₹';

export const ZERO_PAISE: Paise = 0n;

/**
 * Converts a rupee amount into paise (bigint). Accepts a string (preferred,
 * e.g. "1234.56") or a number — but numbers must already be integral or
 * exactly representable to two decimal places; when in doubt, pass a string.
 * Throws on malformed input rather than silently truncating.
 */
export function toPaise(rupees: string | number): Paise {
  const raw = typeof rupees === 'number' ? rupees.toString() : rupees.trim();

  if (!RUPEE_AMOUNT_PATTERN.test(raw)) {
    throw new Error(`toPaise: invalid rupee amount "${rupees}" (expected e.g. "1234.56")`);
  }

  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const dotIndex = unsigned.indexOf('.');
  const wholePart = dotIndex === -1 ? unsigned : unsigned.slice(0, dotIndex);
  const fractionPart = dotIndex === -1 ? '' : unsigned.slice(dotIndex + 1);
  const paddedFraction = fractionPart.padEnd(2, '0');

  const amount = BigInt(wholePart) * 100n + BigInt(paddedFraction);
  return negative && amount !== 0n ? -amount : amount;
}

/** Converts paise (bigint) back into a rupee decimal string, e.g. "1234.56". */
export function toRupees(paise: Paise): string {
  const negative = paise < 0n;
  const abs = negative ? -paise : paise;
  const whole = abs / 100n;
  const fraction = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole.toString()}.${fraction}`;
}

/** Groups a non-negative digit string using the Indian numbering system: 12,34,567 */
function groupIndianDigits(digits: string): string {
  if (digits.length <= 3) return digits;

  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  // `rest` is always 1–2 digits at this point (digits.length > 3 was checked
  // above, and the loop only ever leaves 1 or 2 digits behind), so it's
  // always appended — no further branch needed here.
  groups.unshift(rest);
  return `${groups.join(',')},${last3}`;
}

/** Formats paise as an Indian-locale rupee string, e.g. "₹1,23,456.78". */
export function formatINR(paise: Paise): string {
  const negative = paise < 0n;
  const abs = negative ? -paise : paise;
  const whole = abs / 100n;
  const fraction = (abs % 100n).toString().padStart(2, '0');
  const grouped = groupIndianDigits(whole.toString());
  return `${negative ? '-' : ''}${INR_SYMBOL}${grouped}.${fraction}`;
}

/** Sums any number of paise amounts. `addMoney()` with no arguments returns zero. */
export function addMoney(...amounts: Paise[]): Paise {
  return amounts.reduce((sum, amount) => sum + amount, ZERO_PAISE);
}

/** Subtracts b from a in paise. */
export function subMoney(a: Paise, b: Paise): Paise {
  return a - b;
}

/**
 * Multiplies a paise amount by an integer quantity (e.g. share count, lot
 * size) — never by a fractional number, which would reintroduce float error.
 * Pass a bigint quantity, or an integer `number` that is safe to convert.
 */
export function mulMoney(amount: Paise, quantity: number | bigint): Paise {
  if (typeof quantity === 'number') {
    if (!Number.isInteger(quantity)) {
      throw new Error(
        `mulMoney: quantity must be an integer, got ${quantity}. Money must never be multiplied by a fractional float.`,
      );
    }
    return amount * BigInt(quantity);
  }
  return amount * quantity;
}
