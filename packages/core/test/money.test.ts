import { describe, expect, it } from 'vitest';

import { addMoney, formatINR, mulMoney, subMoney, toPaise, toRupees, ZERO_PAISE } from '../src/money';

describe('toPaise', () => {
  it('converts a whole-rupee string', () => {
    expect(toPaise('100')).toBe(10_000n);
  });

  it('converts a string with two decimal places', () => {
    expect(toPaise('1234.56')).toBe(123_456n);
  });

  it('converts a string with one decimal place, padding to two', () => {
    expect(toPaise('10.5')).toBe(1050n);
  });

  it('converts a plain integer number', () => {
    expect(toPaise(100)).toBe(10_000n);
  });

  it('converts a negative amount', () => {
    expect(toPaise('-12.34')).toBe(-1234n);
  });

  it('handles "-0" without producing a signed zero artifact', () => {
    expect(toPaise('-0')).toBe(0n);
    expect(toPaise('-0.00')).toBe(0n);
  });

  it('converts zero', () => {
    expect(toPaise('0')).toBe(0n);
  });

  it('trims surrounding whitespace', () => {
    expect(toPaise('  42.00  ')).toBe(4200n);
  });

  it.each(['abc', '12.345', '1,234', '', '12.', '--5', '5-'])(
    'throws on malformed input "%s"',
    (input) => {
      expect(() => toPaise(input)).toThrow(/invalid rupee amount/i);
    },
  );
});

describe('toRupees', () => {
  it('formats a positive amount', () => {
    expect(toRupees(123_456n)).toBe('1234.56');
  });

  it('formats zero', () => {
    expect(toRupees(0n)).toBe('0.00');
  });

  it('formats a negative amount', () => {
    expect(toRupees(-1234n)).toBe('-12.34');
  });

  it('pads single-digit fraction', () => {
    expect(toRupees(105n)).toBe('1.05');
  });

  it('round-trips with toPaise', () => {
    expect(toRupees(toPaise('9999.99'))).toBe('9999.99');
  });
});

describe('formatINR', () => {
  it('formats amounts under 1,000 without grouping', () => {
    expect(formatINR(toPaise('999'))).toBe('₹999.00');
  });

  it('formats thousands with one comma', () => {
    expect(formatINR(toPaise('1234'))).toBe('₹1,234.00');
  });

  it('formats ten-thousands', () => {
    expect(formatINR(toPaise('12345'))).toBe('₹12,345.00');
  });

  it('formats lakhs (Indian grouping)', () => {
    expect(formatINR(toPaise('123456'))).toBe('₹1,23,456.00');
  });

  it('formats tens of lakhs', () => {
    expect(formatINR(toPaise('1234567'))).toBe('₹12,34,567.00');
  });

  it('formats crores', () => {
    expect(formatINR(toPaise('12345678'))).toBe('₹1,23,45,678.00');
  });

  it('formats negative amounts with the sign before the symbol', () => {
    expect(formatINR(toPaise('-1234.50'))).toBe('-₹1,234.50');
  });

  it('formats zero', () => {
    expect(formatINR(0n)).toBe('₹0.00');
  });

  it('formats an exact 3-digit boundary (100)', () => {
    expect(formatINR(toPaise('100'))).toBe('₹100.00');
  });

  it('formats an exact 4-digit boundary (1000)', () => {
    expect(formatINR(toPaise('1000'))).toBe('₹1,000.00');
  });
});

describe('addMoney', () => {
  it('returns zero for no arguments', () => {
    expect(addMoney()).toBe(ZERO_PAISE);
  });

  it('returns the value for a single argument', () => {
    expect(addMoney(500n)).toBe(500n);
  });

  it('sums multiple positive amounts', () => {
    expect(addMoney(100n, 200n, 300n)).toBe(600n);
  });

  it('sums amounts including negatives', () => {
    expect(addMoney(500n, -200n, -100n)).toBe(200n);
  });
});

describe('subMoney', () => {
  it('subtracts b from a', () => {
    expect(subMoney(500n, 200n)).toBe(300n);
  });

  it('produces a negative result when b > a', () => {
    expect(subMoney(200n, 500n)).toBe(-300n);
  });

  it('returns zero when equal', () => {
    expect(subMoney(500n, 500n)).toBe(0n);
  });
});

describe('mulMoney', () => {
  it('multiplies by an integer number quantity', () => {
    expect(mulMoney(toPaise('100.50'), 3)).toBe(30_150n);
  });

  it('multiplies by a bigint quantity', () => {
    expect(mulMoney(toPaise('100.50'), 3n)).toBe(30_150n);
  });

  it('multiplies by zero', () => {
    expect(mulMoney(toPaise('100.50'), 0)).toBe(0n);
  });

  it('throws on a fractional number quantity', () => {
    expect(() => mulMoney(toPaise('100'), 1.5)).toThrow(/must be an integer/i);
  });
});
