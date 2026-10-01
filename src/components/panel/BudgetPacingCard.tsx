"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatTry } from "@/lib/panel/format";
import {
  PACE_STATUS_META,
  computeBudgetPacing,
  cumulativeSeries,
  type BudgetDailySpend,
  type PaceTone,
} from "@/lib/panel/budget-pacing";

const toneBadge: Record<PaceTone, string> = {
  ok: "border-[var(--panel-ok-border)] bg-panel-ok-bg text-panel-ok",
  warn: "border-[var(--panel-warn-border)] bg-panel-warn-bg text-panel-warn",
  critical:
    "border-[var(--panel-critical-border)] bg-panel-critical-bg text-panel-critical",
  muted: "border-panel-border bg-panel-surface-muted text-panel-fg-muted",
};

const toneIcon: Record<PaceTone, string> = {
  ok: "✓",
  warn: "!",
  critical: "▲",
  muted: "–",
};

const toneText: Record<PaceTone, string> = {
  ok: "text-panel-ok",
  warn: "text-panel-warn",
  critical: "text-panel-critical",
  muted: "text-panel-fg-muted",
};

export function PaceStatusBadge({
  status,
}: {
  status: keyof typeof PACE_STATUS_META;
}) {
  const meta = PACE_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${toneBadge[meta.tone]}`}
      title={meta.hint}
    >
      <span aria-hidden>{toneIcon[meta.tone]}</span>
      {meta.label}
    </span>
  );
}

/**
 * Ay temposu — beklenen vs gerçekleşen, ay sonu tahmini, önerilen günlük.
 * Grafik: kümülatif harcama ve doğrusal plan çizgisi.
 */
export default function BudgetPacingCard({
  planned,
  from,
  to,
  today,
  daily,
  currency,
  title = "Bütçe temposu",
}: {
  planned: number | null;
  from: string;
  to: string;
  today: string;
  daily: BudgetDailySpend[];
  currency: string;
  title?: string;
}) {
  const spent = daily.reduce((sum, d) => sum + d.google + d.meta, 0);
  const todayRow = daily.find((d) => d.date === today);
  const todaySpend = todayRow ? todayRow.google + todayRow.meta : 0;
  const pacing = computeBudgetPacing({
    planned,
    spent,
    from,
    to,
    today,
    todaySpend,
  });
  const meta = PACE_STATUS_META[pacing.status];
  const finished = today > to;
  const money = (n: number) => formatTry(n, currency);

  const projectedTone: PaceTone =
    pacing.projectedPct == null
      ? "muted"
      : pacing.projectedPct > 110
        ? "critical"
        : pacing.projectedPct < 90
          ? "warn"
          : "ok";

  return (
    <section className="space-y-4 rounded-xl border border-panel-border bg-panel-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-panel-fg">{title}</h3>
            <PaceStatusBadge status={pacing.status} />
          </div>
          <p className="mt-1 text-xs text-panel-fg-secondary">{meta.hint}</p>
        </div>
        <p className="text-[11px] tabular-nums text-panel-fg-muted">
          {finished
            ? `${pacing.totalDays} gün tamamlandı`
            : `${pacing.closedDays}/${pacing.totalDays} gün geçti · ${pacing.remainingDays} gün kaldı`}
        </p>
      </div>

      <PaceRules />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label={finished ? "Planlanan" : "Bugüne kadar beklenen"}
          value={
            finished
              ? planned != null
                ? money(planned)
                : "—"
              : pacing.expectedToDate != null
                ? money(pacing.expectedToDate)
                : "—"
          }
          sub={
            !finished && planned != null
              ? `Plan ${money(planned)} · dünkü kapanışa göre`
              : undefined
          }
        />
        <Metric
          label="Gerçekleşen"
          value={money(finished ? pacing.spent : pacing.spentClosed)}
          sub={
            pacing.deviationPct != null && !finished
              ? `Beklenenden ${pacing.deviationPct > 0 ? "+" : ""}%${pacing.deviationPct}`
              : !finished && todaySpend > 0
                ? `Bugün ${money(todaySpend)}`
                : undefined
          }
          subTone={
            pacing.deviationPct == null || finished
              ? undefined
              : Math.abs(pacing.deviationPct) <= 10
                ? "ok"
                : "warn"
          }
        />
        <Metric
          label={finished ? "Sonuç" : "Dönem sonu tahmini"}
          value={pacing.projected != null ? money(pacing.projected) : "—"}
          sub={
            pacing.projectedPct != null
              ? `Planın %${pacing.projectedPct}’i`
              : pacing.avgDaily == null
                ? "Tahmin için en az 1 gün gerekli"
                : undefined
          }
          subTone={pacing.projectedPct != null ? projectedTone : undefined}
        />
        <Metric
          label={finished ? "Fark" : "Önerilen günlük"}
          value={
            finished
              ? pacing.remaining != null
                ? `${pacing.remaining < 0 ? "+" : "−"}${money(Math.abs(pacing.remaining))}`
                : "—"
              : pacing.recommendedDaily != null
                ? money(pacing.recommendedDaily)
                : "—"
          }
          sub={
            finished
              ? pacing.remaining != null
                ? pacing.remaining < 0
                  ? "Plan üzeri harcama"
                  : "Kullanılmayan bütçe"
                : undefined
              : pacing.avgDaily != null
                ? `Şu an ortalama ${money(pacing.avgDaily)}/gün`
                : undefined
          }
        />
      </div>

      <CumulativeChart
        from={from}
        to={to}
        today={today}
        planned={planned}
        daily={daily}
        currency={currency}
      />
    </section>
  );
}

const PACE_RULES: Array<{
  status: keyof typeof PACE_STATUS_META;
  rule: string;
}> = [
  { status: "on_track", rule: "Sapma −%10 ile +%10 arasında" },
  { status: "fast", rule: "Sapma +%10’dan fazla" },
  { status: "slow", rule: "Sapma −%10’dan az" },
  { status: "over", rule: "Harcama planı geçti" },
];

/** Durum etiketlerinin hangi sapmaya göre verildiği. */
function PaceRules() {
  return (
    <div className="rounded-lg border border-[var(--panel-warn-border)] bg-panel-warn-bg px-3 py-2.5 text-[11px] text-panel-fg-secondary">
      <p className="font-semibold text-panel-warn">
        <span aria-hidden>ⓘ </span>
        Tempo nasıl hesaplanır?
      </p>
      <p className="mt-1">
        Sapma = dünkü kapanışa kadar gerçekleşen ÷ aynı noktada beklenen
        harcama (aylık plan × geçen gün ÷ ayın gün sayısı) − 1
      </p>
      <ul className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {PACE_RULES.map((r) => (
          <li key={r.status} className="flex items-center gap-2">
            <PaceStatusBadge status={r.status} />
            <span>{r.rule}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  subTone,
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: PaceTone;
}) {
  return (
    <div className="rounded-lg border border-panel-border bg-panel-surface-muted/50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-panel-fg-secondary">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-panel-fg">
        {value}
      </p>
      {sub ? (
        <p
          className={`mt-0.5 text-[11px] tabular-nums ${subTone ? `font-semibold ${toneText[subTone]}` : "text-panel-fg-secondary"}`}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}

const CHART_H = 180;
const PAD = { top: 12, right: 12, bottom: 22, left: 12 };

function shortDate(ymd: string): string {
  return `${Number(ymd.slice(8, 10))}.${ymd.slice(5, 7)}`;
}

function compactMoney(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  } catch {
    return formatTry(n, currency);
  }
}

function CumulativeChart({
  from,
  to,
  today,
  planned,
  daily,
  currency,
}: {
  from: string;
  to: string;
  today: string;
  planned: number | null;
  daily: BudgetDailySpend[];
  currency: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const series = useMemo(
    () => cumulativeSeries({ from, to, today, planned, daily }),
    [from, to, today, planned, daily],
  );

  const maxY = Math.max(
    1,
    planned ?? 0,
    ...series.map((p) => p.actualCum ?? 0),
  );
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const n = series.length;
  const x = (i: number) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / maxY) * innerH;

  const planPath =
    planned != null && planned > 0
      ? `M${x(0)},${y(0)} L${x(n - 1)},${y(planned)}`
      : null;
  const actualPts = series
    .map((p, i) => (p.actualCum == null ? null : `${x(i)},${y(p.actualCum)}`))
    .filter(Boolean);
  const actualPath = actualPts.length ? `M${actualPts.join(" L")}` : null;
  const lastActual = [...series].reverse().findIndex((p) => p.actualCum != null);
  const lastIdx = lastActual < 0 ? -1 : n - 1 - lastActual;

  const tickIdx = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];
  const hovered = hover != null ? series[hover] : null;

  function onMove(clientX: number) {
    const el = ref.current;
    if (!el || n === 0 || innerW <= 0) return;
    const rect = el.getBoundingClientRect();
    const rel = clientX - rect.left - PAD.left;
    const i = Math.round((rel / innerW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-[11px] text-panel-fg-secondary">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-panel-fg" />
          Gerçekleşen (kümülatif)
        </span>
        {planPath ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-panel-accent" />
            Plan temposu
          </span>
        ) : null}
      </div>
      <div
        ref={ref}
        className="relative w-full touch-none select-none"
        style={{ height: CHART_H }}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerDown={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label="Kümülatif harcama ve plan temposu grafiği"
      >
        {width > 0 ? (
          <svg width={width} height={CHART_H} className="block overflow-visible">
            {[0.5, 1].map((f) => (
              <line
                key={f}
                x1={PAD.left}
                x2={PAD.left + innerW}
                y1={y(maxY * f)}
                y2={y(maxY * f)}
                stroke="var(--panel-border)"
                strokeDasharray="2 4"
              />
            ))}
            <line
              x1={PAD.left}
              x2={PAD.left + innerW}
              y1={y(0)}
              y2={y(0)}
              stroke="var(--panel-border)"
            />
            {planPath ? (
              <path
                d={planPath}
                fill="none"
                stroke="var(--panel-accent)"
                strokeWidth={2}
                strokeDasharray="6 5"
                strokeLinecap="round"
              />
            ) : null}
            {actualPath ? (
              <path
                d={actualPath}
                fill="none"
                stroke="var(--panel-fg)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {lastIdx >= 0 && hover == null ? (
              <circle
                cx={x(lastIdx)}
                cy={y(series[lastIdx].actualCum ?? 0)}
                r={4}
                fill="var(--panel-fg)"
                stroke="var(--panel-surface)"
                strokeWidth={2}
              />
            ) : null}
            {hovered && hover != null ? (
              <>
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={PAD.top}
                  y2={PAD.top + innerH}
                  stroke="var(--panel-fg-muted)"
                />
                {hovered.planCum != null ? (
                  <circle
                    cx={x(hover)}
                    cy={y(hovered.planCum)}
                    r={4}
                    fill="var(--panel-accent)"
                    stroke="var(--panel-surface)"
                    strokeWidth={2}
                  />
                ) : null}
                {hovered.actualCum != null ? (
                  <circle
                    cx={x(hover)}
                    cy={y(hovered.actualCum)}
                    r={4}
                    fill="var(--panel-fg)"
                    stroke="var(--panel-surface)"
                    strokeWidth={2}
                  />
                ) : null}
              </>
            ) : null}
            {tickIdx.map((i) => (
              <text
                key={i}
                x={x(i)}
                y={CHART_H - 6}
                textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                className="fill-panel-fg-muted text-[10px] tabular-nums"
              >
                {shortDate(series[i]?.date ?? from)}
              </text>
            ))}
            <text
              x={PAD.left + 2}
              y={y(maxY) - 3}
              className="fill-panel-fg-muted text-[10px] tabular-nums"
            >
              {compactMoney(maxY, currency)}
            </text>
          </svg>
        ) : null}
        {hovered && hover != null ? (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-[10rem] rounded-md border border-panel-border bg-panel-surface px-2.5 py-2 text-[11px] shadow-panel"
            style={
              x(hover) > width / 2
                ? { right: width - x(hover) + 10 }
                : { left: x(hover) + 10 }
            }
          >
            <p className="font-semibold text-panel-fg">
              {shortDate(hovered.date)} · {hovered.day}. gün
            </p>
            <Row
              label="Gerçekleşen"
              value={
                hovered.actualCum != null
                  ? formatTry(hovered.actualCum, currency)
                  : "—"
              }
              swatch="bg-panel-fg"
            />
            {hovered.planCum != null ? (
              <Row
                label="Plan"
                value={formatTry(hovered.planCum, currency)}
                swatch="bg-panel-accent"
              />
            ) : null}
            {hovered.spend != null ? (
              <Row
                label="O gün"
                value={formatTry(hovered.spend, currency)}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  swatch,
}: {
  label: string;
  value: string;
  swatch?: string;
}) {
  return (
    <p className="mt-1 flex items-center justify-between gap-3 text-panel-fg-secondary">
      <span className="inline-flex items-center gap-1.5">
        {swatch ? <span className={`size-2 rounded-full ${swatch}`} /> : null}
        {label}
      </span>
      <span className="font-medium tabular-nums text-panel-fg">{value}</span>
    </p>
  );
}
