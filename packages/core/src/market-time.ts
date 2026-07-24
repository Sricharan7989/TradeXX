/**
 * NSE market-hours logic. All wall-clock reasoning happens in IST
 * (Asia/Kolkata, a fixed UTC+5:30 offset — India observes no DST), while
 * every Date in and out remains a normal UTC instant, per the TIME global
 * rule (store/pass timestamps as UTC, render in IST).
 */

export const IST_TIMEZONE = 'Asia/Kolkata';
export const IST_OFFSET_MINUTES = 5 * 60 + 30;

export const MARKET_OPEN_HOUR = 9;
export const MARKET_OPEN_MINUTE = 15;
export const MARKET_CLOSE_HOUR = 15;
export const MARKET_CLOSE_MINUTE = 30;

/**
 * STUB holiday calendar (IST calendar dates, "YYYY-MM-DD"). NSE publishes an
 * authoritative trading holiday list each year — replace/extend this with
 * that list (or load it from config/DB) before relying on this in
 * production. Weekends are handled separately and need no entry here.
 */
export const NSE_HOLIDAYS: readonly string[] = [
  '2026-01-26', // Republic Day
  '2026-03-04', // Holi
  '2026-04-03', // Good Friday
  '2026-04-14', // Dr. Ambedkar Jayanti
  '2026-05-01', // Maharashtra Day
  '2026-08-15', // Independence Day
  '2026-10-02', // Gandhi Jayanti
  '2026-10-20', // Diwali (Laxmi Pujan)
  '2026-11-24', // Gurunanak Jayanti
  '2026-12-25', // Christmas
];

interface ISTParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

const WEEKDAY_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
} as const;
type WeekdayAbbrev = keyof typeof WEEKDAY_INDEX;

const istFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: IST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hour12: false,
});

type ISTFormatField = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'weekday';

function getISTParts(date: Date): ISTParts {
  const entries = istFormatter
    .formatToParts(date)
    .filter((part): part is Intl.DateTimeFormatPart & { type: ISTFormatField } => part.type !== 'literal')
    .map((part) => [part.type, part.value] as const);

  // formatToParts is called with exactly these six field options above, so the
  // result is guaranteed to contain all of them — this assertion documents
  // that contract rather than papering over a genuinely unknown shape.
  const map = Object.fromEntries(entries) as Record<ISTFormatField, string>;

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: WEEKDAY_INDEX[map.weekday as WeekdayAbbrev],
  };
}

function toDateKey(parts: Pick<ISTParts, 'year' | 'month' | 'day'>): string {
  const y = parts.year.toString().padStart(4, '0');
  const m = parts.month.toString().padStart(2, '0');
  const d = parts.day.toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Converts an IST wall-clock date/time into the corresponding UTC Date instant. */
function istWallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const naiveUtcMillis = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  return new Date(naiveUtcMillis - IST_OFFSET_MINUTES * 60_000);
}

export function isWeekend(date: Date): boolean {
  const { weekday } = getISTParts(date);
  return weekday === 0 || weekday === 6;
}

export function isTradingHoliday(date: Date, holidays: readonly string[] = NSE_HOLIDAYS): boolean {
  return holidays.includes(toDateKey(getISTParts(date)));
}

function isTradingDay(parts: ISTParts, holidays: readonly string[]): boolean {
  if (parts.weekday === 0 || parts.weekday === 6) return false;
  return !holidays.includes(toDateKey(parts));
}

/**
 * Whether NSE is open for trading at the given instant (default: now).
 * Trading hours are 09:15–15:30 IST, Monday–Friday, excluding holidays.
 */
export function isMarketOpen(date: Date = new Date(), holidays: readonly string[] = NSE_HOLIDAYS): boolean {
  const parts = getISTParts(date);
  if (!isTradingDay(parts, holidays)) return false;

  const minutesNow = parts.hour * 60 + parts.minute;
  const openMinutes = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MINUTE;
  const closeMinutes = MARKET_CLOSE_HOUR * 60 + MARKET_CLOSE_MINUTE;
  return minutesNow >= openMinutes && minutesNow <= closeMinutes;
}

/**
 * The next instant NSE opens for trading, strictly after `from` unless
 * `from` is itself before today's open on a trading day (in which case
 * today's open is returned). Searches forward up to 30 calendar days.
 */
export function nextMarketOpen(from: Date = new Date(), holidays: readonly string[] = NSE_HOLIDAYS): Date {
  const parts = getISTParts(from);
  const minutesNow = parts.hour * 60 + parts.minute;
  const openMinutes = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MINUTE;

  if (isTradingDay(parts, holidays) && minutesNow < openMinutes) {
    return istWallTimeToUtc(parts.year, parts.month, parts.day, MARKET_OPEN_HOUR, MARKET_OPEN_MINUTE);
  }

  let candidate = istWallTimeToUtc(parts.year, parts.month, parts.day, 0, 0);
  const MAX_DAYS_TO_SEARCH = 30;
  for (let i = 0; i < MAX_DAYS_TO_SEARCH; i++) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
    const candidateParts = getISTParts(candidate);
    if (isTradingDay(candidateParts, holidays)) {
      return istWallTimeToUtc(
        candidateParts.year,
        candidateParts.month,
        candidateParts.day,
        MARKET_OPEN_HOUR,
        MARKET_OPEN_MINUTE,
      );
    }
  }

  throw new Error(
    `nextMarketOpen: no trading day found within ${MAX_DAYS_TO_SEARCH} days — check the NSE_HOLIDAYS calendar`,
  );
}
