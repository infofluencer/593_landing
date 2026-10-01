/**
 * Bütçe temposu — saf hesap (client + server). Prisma import etmez.
 *
 * Bugün henüz bitmediği için "beklenen" ve "tahmin" dünkü kapanışa göre
 * hesaplanır; bugünün kısmi harcaması kalan bütçeden düşülür.
 */

export type BudgetPaceStatus =
  | "none"
  | "upcoming"
  | "on_track"
  | "fast"
  | "slow"
  | "over"
  | "done_on_plan"
  | "done_under"
  | "done_over";

export type BudgetDailySpend = {
  date: string;
  google: number;
  meta: number;
};

export type BudgetPacing = {
  status: BudgetPaceStatus;
  planned: number | null;
  spent: number;
  totalDays: number;
  /** Tamamlanmış gün (bugün hariç; dönem bittiyse tümü). */
  closedDays: number;
  remainingDays: number;
  /** Kapanmış günlere göre bu noktaya kadar harcanmış olması gereken. */
  expectedToDate: number | null;
  /** Kapanmış günlerin harcaması. */
  spentClosed: number;
  /** Gerçekleşen / beklenen − 1 (yüzde). */
  deviationPct: number | null;
  /** Mevcut günlük ortalamayla dönem sonu tahmini. */
  projected: number | null;
  projectedPct: number | null;
  /** Planı tutturmak için bugünden itibaren gereken günlük harcama. */
  recommendedDaily: number | null;
  avgDaily: number | null;
  remaining: number | null;
};

const DAY_MS = 86_400_000;

function ymdUtc(ymd: string): number {
  return Date.UTC(
    Number(ymd.slice(0, 4)),
    Number(ymd.slice(5, 7)) - 1,
    Number(ymd.slice(8, 10)),
  );
}

export function dayCount(from: string, to: string): number {
  if (from > to) return 0;
  return Math.round((ymdUtc(to) - ymdUtc(from)) / DAY_MS) + 1;
}

/** Tolerans: beklenenden ±%10 sapma "planda" sayılır. */
const PACE_TOLERANCE = 0.1;

export function computeBudgetPacing(opts: {
  planned: number | null;
  spent: number;
  from: string;
  to: string;
  today: string;
  /** Bugünün (kısmi) harcaması — kapanmış günlerden ayrılır. */
  todaySpend: number;
}): BudgetPacing {
  const { from, to, today } = opts;
  const planned = opts.planned != null && opts.planned > 0 ? opts.planned : null;
  const totalDays = Math.max(1, dayCount(from, to));
  const upcoming = today < from;
  const finished = today > to;

  const closedDays = finished
    ? totalDays
    : upcoming
      ? 0
      : Math.max(0, dayCount(from, today) - 1);
  const spentClosed = finished
    ? opts.spent
    : Math.max(0, opts.spent - opts.todaySpend);
  const remainingDays = totalDays - closedDays;
  const avgDaily = closedDays > 0 ? spentClosed / closedDays : null;

  const projected = finished
    ? opts.spent
    : avgDaily != null
      ? spentClosed + avgDaily * remainingDays
      : null;

  const base: BudgetPacing = {
    status: "none",
    planned,
    spent: opts.spent,
    totalDays,
    closedDays,
    remainingDays,
    expectedToDate: null,
    spentClosed,
    deviationPct: null,
    projected,
    projectedPct: null,
    recommendedDaily: null,
    avgDaily,
    remaining: null,
  };
  if (planned == null) return base;

  const expectedToDate = (planned * closedDays) / totalDays;
  const remaining = planned - opts.spent;
  const deviationPct =
    expectedToDate > 0
      ? Math.round((spentClosed / expectedToDate - 1) * 100)
      : null;
  const projectedPct =
    projected != null ? Math.round((projected / planned) * 100) : null;
  const recommendedDaily =
    !finished && remainingDays > 0
      ? Math.max(0, (planned - spentClosed) / remainingDays)
      : null;

  let status: BudgetPaceStatus;
  if (upcoming) {
    status = "upcoming";
  } else if (finished) {
    const ratio = opts.spent / planned;
    status =
      ratio > 1 + PACE_TOLERANCE / 2
        ? "done_over"
        : ratio < 1 - PACE_TOLERANCE
          ? "done_under"
          : "done_on_plan";
  } else if (opts.spent >= planned) {
    status = "over";
  } else if (closedDays === 0 || deviationPct == null) {
    status = "on_track";
  } else if (deviationPct > PACE_TOLERANCE * 100) {
    status = "fast";
  } else if (deviationPct < -PACE_TOLERANCE * 100) {
    status = "slow";
  } else {
    status = "on_track";
  }

  return {
    ...base,
    status,
    expectedToDate,
    deviationPct,
    projectedPct,
    recommendedDaily,
    remaining,
  };
}

export type PaceTone = "ok" | "warn" | "critical" | "muted";

export const PACE_STATUS_META: Record<
  BudgetPaceStatus,
  { label: string; tone: PaceTone; hint: string }
> = {
  none: {
    label: "Plan yok",
    tone: "muted",
    hint: "Bu dönem için planlanan bütçe girilmemiş.",
  },
  upcoming: {
    label: "Başlamadı",
    tone: "muted",
    hint: "Dönem henüz başlamadı.",
  },
  on_track: {
    label: "Planda",
    tone: "ok",
    hint: "Harcama planlanan tempoya uygun ilerliyor.",
  },
  fast: {
    label: "Hızlı gidiyor",
    tone: "warn",
    hint: "Bu tempoyla bütçe ay bitmeden tükenebilir.",
  },
  slow: {
    label: "Yavaş gidiyor",
    tone: "warn",
    hint: "Harcama planın gerisinde — bütçe kullanılmadan kalabilir.",
  },
  over: {
    label: "Bütçe aşıldı",
    tone: "critical",
    hint: "Planlanan bütçenin tamamı harcandı.",
  },
  done_on_plan: {
    label: "Planda tamamlandı",
    tone: "ok",
    hint: "Dönem planlanan bütçeye uygun kapandı.",
  },
  done_under: {
    label: "Plan altında kapandı",
    tone: "warn",
    hint: "Dönem planlanan bütçenin altında kapandı.",
  },
  done_over: {
    label: "Plan aşılarak kapandı",
    tone: "critical",
    hint: "Dönem planlanan bütçenin üzerinde kapandı.",
  },
};

/** Gün gün kümülatif gerçekleşen + doğrusal plan çizgisi. */
export function cumulativeSeries(opts: {
  from: string;
  to: string;
  today: string;
  planned: number | null;
  daily: BudgetDailySpend[];
}): Array<{
  date: string;
  day: number;
  planCum: number | null;
  actualCum: number | null;
  spend: number | null;
}> {
  const total = Math.max(1, dayCount(opts.from, opts.to));
  const byDate = new Map(opts.daily.map((d) => [d.date, d.google + d.meta]));
  const out = [];
  let cum = 0;
  const start = ymdUtc(opts.from);
  for (let i = 0; i < total; i++) {
    const date = new Date(start + i * DAY_MS).toISOString().slice(0, 10);
    const future = date > opts.today;
    const spend = future ? null : (byDate.get(date) ?? 0);
    if (spend != null) cum += spend;
    out.push({
      date,
      day: i + 1,
      planCum:
        opts.planned != null && opts.planned > 0
          ? (opts.planned * (i + 1)) / total
          : null,
      actualCum: future ? null : cum,
      spend,
    });
  }
  return out;
}
