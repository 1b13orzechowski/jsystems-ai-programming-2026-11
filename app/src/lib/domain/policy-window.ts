// Policy window (ADR-002 §4): return (zwrot) = 14 calendar days, complaint (reklamacja) = 24 calendar months.
// All arithmetic runs on calendar dates (YYYY-MM-DD), never on local time, so DST cannot shift a day.
import type { CaseType } from "./categories";
import { type PolicyWindow, PolicyWindowSchema } from "./schemas";

const RETURN_LIMIT_DAYS = 14;
const COMPLAINT_LIMIT_MONTHS = 24;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type YearMonthDay = { year: number; month: number; day: number };

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = dateFormatters.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  dateFormatters.set(timeZone, formatter);
  return formatter;
}

/** Calendar date (`YYYY-MM-DD`) of `now` in the given IANA time zone. */
export function todayInTimeZone(now: Date, timeZone: string): string {
  return dateFormatterFor(timeZone).format(now);
}

function parseYmd(value: string): YearMonthDay {
  const match = DATE_PATTERN.exec(value);
  const [, year, month, day] = match ?? [];
  if (year === undefined || month === undefined || day === undefined) {
    throw new RangeError(`Expected a YYYY-MM-DD date, got "${value}"`);
  }
  return { year: Number(year), month: Number(month), day: Number(day) };
}

function formatYmd({ year, month, day }: YearMonthDay): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Days since 1970-01-01 for a calendar date; differences give whole calendar days. */
function dayNumber(date: YearMonthDay): number {
  return Date.UTC(date.year, date.month - 1, date.day) / MS_PER_DAY;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Adds calendar months; a day missing in the target month clamps to that month's last day. */
function addMonths(date: YearMonthDay, months: number): YearMonthDay {
  const monthIndex = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
}

export function computePolicyWindow(args: {
  caseType: CaseType;
  purchaseDate: string;
  now: Date;
  timeZone: string;
}): PolicyWindow {
  const submissionDate = todayInTimeZone(args.now, args.timeZone);
  const purchase = parseYmd(args.purchaseDate);
  const submission = parseYmd(submissionDate);

  const elapsedDays = dayNumber(submission) - dayNumber(purchase);
  if (elapsedDays < 0) {
    throw new RangeError(`purchaseDate ${args.purchaseDate} is after submissionDate ${submissionDate}`);
  }

  // Whole months: the month n counts once purchase + n months <= submission.
  let elapsedMonths = (submission.year - purchase.year) * 12 + (submission.month - purchase.month);
  if (elapsedMonths > 0 && formatYmd(addMonths(purchase, elapsedMonths)) > submissionDate) {
    elapsedMonths -= 1;
  }

  if (args.caseType === "zwrot") {
    return PolicyWindowSchema.parse({
      submissionDate,
      purchaseDate: args.purchaseDate,
      elapsedDays,
      elapsedMonths,
      limitUnit: "days",
      limitValue: RETURN_LIMIT_DAYS,
      withinWindow: elapsedDays <= RETURN_LIMIT_DAYS,
    });
  }

  const windowEnd = formatYmd(addMonths(purchase, COMPLAINT_LIMIT_MONTHS));
  return PolicyWindowSchema.parse({
    submissionDate,
    purchaseDate: args.purchaseDate,
    elapsedDays,
    elapsedMonths,
    limitUnit: "months",
    limitValue: COMPLAINT_LIMIT_MONTHS,
    withinWindow: submissionDate <= windowEnd,
  });
}
