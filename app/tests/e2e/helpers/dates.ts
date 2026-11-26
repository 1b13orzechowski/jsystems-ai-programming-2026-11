// Relative dates are computed in Europe/Warsaw, the timezone of the browser projects (playwright.config.ts).

const WARSAW = "Europe/Warsaw";

function warsawToday(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WARSAW,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const read = (type: string): number => Number(parts.find((part) => part.type === type)?.value ?? "NaN");
  return { year: read("year"), month: read("month"), day: read("day") };
}

function format(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

/** Today's date in Europe/Warsaw as YYYY-MM-DD. */
export function todayWarsaw(): string {
  const { year, month, day } = warsawToday();
  return format(year, month, day);
}

/** The date n days before today (Europe/Warsaw) as YYYY-MM-DD. */
export function daysAgo(n: number): string {
  const { year, month, day } = warsawToday();
  return format(year, month, day - n);
}

/** The date n calendar months before today (Europe/Warsaw) as YYYY-MM-DD, day clamped to the month length. */
export function monthsAgo(n: number): string {
  const { year, month, day } = warsawToday();
  const targetMonthIndex = month - 1 - n;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return format(targetYear, targetMonth + 1, Math.min(day, lastDay));
}

/** Tomorrow's date (Europe/Warsaw) as YYYY-MM-DD; used for the future-date validation (AC-06). */
export function tomorrow(): string {
  const { year, month, day } = warsawToday();
  return format(year, month, day + 1);
}
