import { getIstanbulTodayYmd } from "@/lib/date/now";
import {
  addDaysYmd,
  formatYmdTr,
  isValidYmd,
  startOfIstanbulMonthYmd,
  subMonthsYmd,
} from "@/lib/date/tr";

/** Days of ad metrics ingested on each “Veriyi yenile” (Istanbul calendar). */
export const SYNC_HISTORY_DAYS = 720;

/**
 * Ad / adset / breakdown insights lookback.
 * Full 720d × ad-level blows Meta “reduce the amount of data” — keep shorter.
 */
export const SYNC_AD_LEVEL_DAYS = 90;

export type PanelPeriod = "mtd" | "1" | "3" | "6" | "12" | "24" | "custom";

export type PanelDateRange = {
  startDate: string;
  endDate: string;
  period: PanelPeriod;
  label: string;
};

/** Month-based relative periods (bitiş = bugün). */
const RELATIVE_MONTHS: Partial<Record<PanelPeriod, number>> = {
  "1": 1,
  "3": 3,
  "6": 6,
  "12": 12,
};

export function parsePanelPeriod(raw: string | undefined | null): PanelPeriod {
  if (
    raw === "mtd" ||
    raw === "1" ||
    raw === "3" ||
    raw === "6" ||
    raw === "12" ||
    raw === "24" ||
    raw === "custom"
  )
    return raw;
  return "mtd";
}

/** Earliest YMD that sync is expected to have populated. */
export function syncFloorYmd(today: string): string {
  return addDaysYmd(today, -SYNC_HISTORY_DAYS);
}

export function sanitizePanelDateRange(opts: {
  startDate: string;
  endDate: string;
  today: string;
}): { startDate: string; endDate: string } {
  const floor = syncFloorYmd(opts.today);
  let start = isValidYmd(opts.startDate) ? opts.startDate : opts.today;
  let end = isValidYmd(opts.endDate) ? opts.endDate : opts.today;
  if (end > opts.today) end = opts.today;
  if (start > opts.today) start = opts.today;
  if (start < floor) start = floor;
  if (end < floor) end = floor;
  if (start > end) {
    const t = start;
    start = end;
    end = t;
  }
  return { startDate: start, endDate: end };
}

function labelFor(
  period: PanelPeriod,
  startDate: string,
  endDate: string,
): string {
  const span = `${formatYmdTr(startDate)} – ${formatYmdTr(endDate)}`;
  switch (period) {
    case "mtd":
      return `Bu ay · ${span}`;
    case "1":
      return `Son 1 ay · ${span}`;
    case "3":
      return `Son 3 ay · ${span}`;
    case "6":
      return `Son 6 ay · ${span}`;
    case "12":
      return `Son 12 ay · ${span}`;
    case "24":
      return `Son ${SYNC_HISTORY_DAYS} gün · ${span}`;
    case "custom":
      return span;
  }
}

export type PanelDateQuery = {
  period?: string | string[];
  start?: string | string[];
  end?: string | string[];
};

function one(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

/**
 * URL searchParams → Istanbul inclusive YMD range.
 * Relative periods recompute from “today” each request; custom is fixed.
 * All ranges clamp to the sync history floor (SYNC_HISTORY_DAYS).
 */
export async function resolvePanelDateRange(
  query: PanelDateQuery = {},
): Promise<PanelDateRange> {
  const today = await getIstanbulTodayYmd();
  const period = parsePanelPeriod(one(query.period));
  const floor = syncFloorYmd(today);

  if (period === "custom") {
    const { startDate, endDate } = sanitizePanelDateRange({
      startDate: one(query.start) || today,
      endDate: one(query.end) || today,
      today,
    });
    return {
      startDate,
      endDate,
      period,
      label: labelFor(period, startDate, endDate),
    };
  }

  if (period === "mtd") {
    let startDate = startOfIstanbulMonthYmd(today);
    if (startDate < floor) startDate = floor;
    return {
      startDate,
      endDate: today,
      period,
      label: labelFor(period, startDate, today),
    };
  }

  if (period === "24") {
    return {
      startDate: floor,
      endDate: today,
      period,
      label: labelFor(period, floor, today),
    };
  }

  const months = RELATIVE_MONTHS[period] ?? 1;
  let startDate = subMonthsYmd(today, months);
  if (startDate < floor) startDate = floor;
  return {
    startDate,
    endDate: today,
    period,
    label: labelFor(period, startDate, today),
  };
}

/** Sync ingest window: today − SYNC_HISTORY_DAYS → today (Istanbul). */
export async function syncLookbackRange(): Promise<{
  from: string;
  to: string;
}> {
  const today = await getIstanbulTodayYmd();
  return { from: syncFloorYmd(today), to: today };
}

/** Shorter window for ad / adset / breakdown Meta pulls. */
export async function syncAdLevelLookbackRange(): Promise<{
  from: string;
  to: string;
}> {
  const today = await getIstanbulTodayYmd();
  return { from: addDaysYmd(today, -SYNC_AD_LEVEL_DAYS), to: today };
}

export function buildPeriodHref(
  pathname: string,
  opts: { period: PanelPeriod; start?: string; end?: string },
): string {
  const q = new URLSearchParams();
  q.set("period", opts.period);
  if (opts.period === "custom") {
    if (opts.start) q.set("start", opts.start);
    if (opts.end) q.set("end", opts.end);
  }
  const qs = q.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
