/** Europe/Istanbul calendar helpers — day = YYYY-MM-DD. */

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidYmd(s: string): boolean {
  if (!YMD_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Format an instant as Istanbul calendar YYYY-MM-DD. */
export function istanbulYmd(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Calendar @db.Date bound (UTC midnight of that YMD). */
export function ymdToUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Add calendar days to a YMD (Istanbul day arithmetic via UTC date parts). */
export function addDaysYmd(ymd: string, days: number): string {
  const dt = ymdToUtcDate(ymd);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** First day of Istanbul month containing `ymd`. */
export function startOfIstanbulMonthYmd(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

/** Subtract N calendar months from a YMD; clamp day to month length. */
export function subMonthsYmd(ymd: string, months: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 - months, 1));
  const last = new Date(
    Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0),
  ).getUTCDate();
  dt.setUTCDate(Math.min(d, last));
  return dt.toISOString().slice(0, 10);
}

/** TR medium date for a YMD (noon Istanbul). */
export function formatYmdTr(ymd: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeZone: "Europe/Istanbul",
  }).format(new Date(`${ymd}T12:00:00+03:00`));
}
