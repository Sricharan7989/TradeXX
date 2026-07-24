import { describe, expect, it } from 'vitest';

import { isMarketOpen, isTradingHoliday, isWeekend, nextMarketOpen } from '../src/market-time';

// All reference instants below are UTC ISO strings; the comment on each notes
// the equivalent IST wall-clock time (UTC + 5:30, no DST) that the assertion
// is really about. Verified against real weekday names (2026-07-23 = Thu,
// 2026-07-25/26 = Sat/Sun, 2026-01-26 = Mon/Republic Day holiday).

describe('isWeekend', () => {
  it('is false for a Thursday', () => {
    expect(isWeekend(new Date('2026-07-23T06:30:00Z'))).toBe(false);
  });

  it('is true for a Saturday', () => {
    expect(isWeekend(new Date('2026-07-25T06:30:00Z'))).toBe(true);
  });

  it('is true for a Sunday', () => {
    expect(isWeekend(new Date('2026-07-26T06:30:00Z'))).toBe(true);
  });
});

describe('isTradingHoliday', () => {
  it('is true on a listed holiday (Republic Day 2026-01-26)', () => {
    expect(isTradingHoliday(new Date('2026-01-26T06:30:00Z'))).toBe(true);
  });

  it('is false on a non-holiday trading day', () => {
    expect(isTradingHoliday(new Date('2026-07-23T06:30:00Z'))).toBe(false);
  });

  it('accepts a custom holiday list override', () => {
    expect(isTradingHoliday(new Date('2026-07-23T06:30:00Z'), ['2026-07-23'])).toBe(true);
  });
});

describe('isMarketOpen', () => {
  it('is true exactly at open (09:15 IST) on a trading day', () => {
    expect(isMarketOpen(new Date('2026-07-23T03:45:00Z'))).toBe(true);
  });

  it('is false one minute before open (09:14 IST)', () => {
    expect(isMarketOpen(new Date('2026-07-23T03:44:00Z'))).toBe(false);
  });

  it('is true mid-session (12:00 IST)', () => {
    expect(isMarketOpen(new Date('2026-07-23T06:30:00Z'))).toBe(true);
  });

  it('is true exactly at close (15:30 IST)', () => {
    expect(isMarketOpen(new Date('2026-07-23T10:00:00Z'))).toBe(true);
  });

  it('is false one minute after close (15:31 IST)', () => {
    expect(isMarketOpen(new Date('2026-07-23T10:01:00Z'))).toBe(false);
  });

  it('is false on a Saturday during would-be trading hours', () => {
    expect(isMarketOpen(new Date('2026-07-25T06:30:00Z'))).toBe(false);
  });

  it('is false on a Sunday during would-be trading hours', () => {
    expect(isMarketOpen(new Date('2026-07-26T06:30:00Z'))).toBe(false);
  });

  it('is false on a weekday holiday (Republic Day)', () => {
    expect(isMarketOpen(new Date('2026-01-26T06:30:00Z'))).toBe(false);
  });

  it('respects a custom holiday list override', () => {
    // 2026-07-23 is a normal Thursday, but we mark it a holiday explicitly.
    expect(isMarketOpen(new Date('2026-07-23T06:30:00Z'), ['2026-07-23'])).toBe(false);
  });
});

describe('nextMarketOpen', () => {
  it('returns today’s open when called before open on a trading day', () => {
    const result = nextMarketOpen(new Date('2026-07-23T03:00:00Z')); // 08:30 IST, before open
    expect(result.toISOString()).toBe('2026-07-23T03:45:00.000Z');
  });

  it('returns tomorrow’s open when called during market hours', () => {
    const result = nextMarketOpen(new Date('2026-07-23T06:30:00Z')); // 12:00 IST
    expect(result.toISOString()).toBe('2026-07-24T03:45:00.000Z');
  });

  it('returns the next day’s open when called after close', () => {
    const result = nextMarketOpen(new Date('2026-07-23T10:30:00Z')); // 16:00 IST
    expect(result.toISOString()).toBe('2026-07-24T03:45:00.000Z');
  });

  it('skips a weekend to land on the following Monday', () => {
    // Friday 2026-07-24 after close -> skip Sat/Sun -> Monday 2026-07-27 open.
    const result = nextMarketOpen(new Date('2026-07-24T10:30:00Z'));
    expect(result.toISOString()).toBe('2026-07-27T03:45:00.000Z');
  });

  it('skips a weekend AND a holiday to land on the next trading day', () => {
    // Sunday 2026-01-25 -> skip Sun (weekend), Mon 2026-01-26 (Republic Day
    // holiday) -> Tue 2026-01-27 open.
    const result = nextMarketOpen(new Date('2026-01-25T06:30:00Z'));
    expect(result.toISOString()).toBe('2026-01-27T03:45:00.000Z');
  });

  it('is a no-op-forward when called exactly at open (treated as already open, not "before")', () => {
    const result = nextMarketOpen(new Date('2026-07-23T03:45:00Z')); // exactly 09:15 IST
    expect(result.toISOString()).toBe('2026-07-24T03:45:00.000Z');
  });

  it('throws if no trading day is found within the search window', () => {
    const from = new Date('2026-07-23T06:30:00Z');
    // Build 40 consecutive IST-calendar-date holidays starting the day
    // after `from`, guaranteeing every candidate in the 30-day search window
    // is blocked.
    const blockAllHolidays: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const d = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
      blockAllHolidays.push(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
    }
    expect(() => nextMarketOpen(from, blockAllHolidays)).toThrow(/no trading day found/i);
  });
});
