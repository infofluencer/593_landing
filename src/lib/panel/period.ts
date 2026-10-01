import { getIstanbulTodayYmd } from "@/lib/date/now";
import {
  addDaysYmd,
  formatYmdTr,
  istanbulYmd,
  isValidYmd,
  startOfIstanbulMonthYmd,
  subMonthsYmd,
} from "@/lib/date/tr";

/** Days of ad metrics ingested on each “Veriyi yenile” (Istanbul calendar). */
export const SYNC_HISTORY_DAYS = 720;

/**
 * Scheduled daily sync windows (inclusive, today − N → today).
 * Dönüşümler tıklama/gösterim gününe geriye dönük yazılır:
 * - Meta: varsayılan atıf 7g tık → son 7 gün değişebilir.
 * - Google Ads: dönüşüm gecikmesi 30+ gün sürebilir.
 */
export const SYNC_DAILY_META_DAYS = 7;
export const SYNC_DAILY_GOOGLE_DAYS = 30;

/**
 * Ad / adset / breakdown insights lookback.
 * Full 720d × ad-level blows Meta “reduce the amount of data” — keep shorter.
 */
export const SYNC_AD_LEVEL_DAYS = 90;

export type PanelPeriod =
  | "yesterday"
  | "7d"
  | "30d"
  | "mtd"
  | "lastmonth"
  | "1"
  | "3"
  | "6"
  | "12"
  | "24"
  | "custom";

/** Hazır dönem düğmeleri (PeriodFilterBar + DateRangePicker ortak). */
export const PANEL_PERIOD_PRESETS: { period: PanelPeriod; label: string }[] = [
  { period: "yesterday", label: "Dün" },
  { period: "7d", label: "Son 7 gün" },
  { period: "30d", label: "Son 30 gün" },
  { period: "mtd", label: "Bu ay" },
  { period: "lastmonth", label: "Geçen ay" },
  { period: "3", label: "3 ay" },
  { period: "6", label: "6 ay" },
  { period: "12", label: "12 ay" },
  { period: "24", label: `${SYNC_HISTORY_DAYS} gün` },
];

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
    raw === "yesterday" ||
    raw === "7d" ||
    raw === "30d" ||
    raw === "lastmonth" ||
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
    case "yesterday":
      return `Dün · ${formatYmdTr(startDate)}`;
    case "7d":
      return `Son 7 gün · ${span}`;
    case "30d":
      return `Son 30 gün · ${span}`;
    case "lastmonth":
      return `Geçen ay · ${span}`;
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

  const fixed = (startDate: string, endDate: string): PanelDateRange => {
    const s = startDate < floor ? floor : startDate;
    return { startDate: s, endDate, period, label: labelFor(period, s, endDate) };
  };

  if (period === "yesterday") {
    const y = addDaysYmd(today, -1);
    return fixed(y, y);
  }
  // "Son N gün" bugünü içerir: today − (N−1) → today
  if (period === "7d") return fixed(addDaysYmd(today, -6), today);
  if (period === "30d") return fixed(addDaysYmd(today, -29), today);
  if (period === "lastmonth") {
    const thisMonthStart = startOfIstanbulMonthYmd(today);
    const lastMonthEnd = addDaysYmd(thisMonthStart, -1);
    return fixed(startOfIstanbulMonthYmd(lastMonthEnd), lastMonthEnd);
  }

  if (period === "24") {
    return fixed(addDaysYmd(today, -(SYNC_HISTORY_DAYS - 1)), today);
  }

  // "Son N ay": aynı günden bir sonraki gün başlar (1 ay = 30/31 gün, fazladan gün yok).
  const months = RELATIVE_MONTHS[period] ?? 1;
  let startDate = addDaysYmd(subMonthsYmd(today, months), 1);
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

/** Short windows for twice-daily campaign metrics (per provider). */
export function syncDailyLookbackRange(today = istanbulYmd(new Date())): {
  meta: { from: string; to: string };
  google: { from: string; to: string };
} {
  return {
    meta: { from: addDaysYmd(today, -SYNC_DAILY_META_DAYS), to: today },
    google: { from: addDaysYmd(today, -SYNC_DAILY_GOOGLE_DAYS), to: today },
  };
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
