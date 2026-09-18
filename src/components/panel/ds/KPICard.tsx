"use client";

import type { CSSProperties, ReactNode } from "react";
import { TrendingDown, TrendingUp, X } from "lucide-react";
import type { MetricGoodDirection, MetricKind } from "@/lib/panel/metric-kinds";
import { deltaInvertFor, metricDef } from "@/lib/panel/metric-kinds";
import { getMetricDescription } from "@/lib/panel/metric-descriptions";
import { MetricHelpTooltip } from "./MetricHelpTooltip";

export type KpiTier = 1 | 2 | 3;

const KIND_LABEL_TONE: Partial<Record<MetricKind, string>> = {
  money: "text-panel-fg-secondary",
  rate: "text-panel-fg-secondary",
  multiplier: "text-[#b45309]",
  count: "text-panel-fg-secondary",
  duration: "text-panel-fg-secondary",
};

const KIND_VALUE_TONE: Partial<Record<MetricKind, string>> = {
  multiplier: "text-[#b45309]",
};

const TIER_SHELL: Record<
  KpiTier,
  { pad: string; value: string; label: string; radius: string }
> = {
  1: {
    pad: "p-5 sm:p-6",
    value: "text-3xl sm:text-4xl font-semibold tracking-tight",
    label: "text-[11px] font-semibold uppercase tracking-[0.14em]",
    radius: "rounded-panel-lg",
  },
  2: {
    pad: "p-4",
    value: "text-xl sm:text-2xl font-semibold tracking-tight",
    label: "text-[10px] font-semibold uppercase tracking-[0.12em]",
    radius: "rounded-panel-md",
  },
  3: {
    pad: "p-3",
    value: "text-base font-semibold tracking-tight",
    label: "text-[10px] font-medium uppercase tracking-[0.1em]",
    radius: "rounded-panel-md",
  },
};

/**
 * Standart KPI kartı — tier hiyerarşisi + (?) sözlük tooltip.
 * value formatlanmış string; null → Kontrol edilemedi (asla 0).
 */
export function KPICard({
  label,
  value,
  kind = "count",
  hint,
  delta,
  goodDirection,
  deltaInvert,
  tier = 2,
  metricKey,
  accent,
  sparkline,
  className = "",
}: {
  label?: string;
  value: string | null | undefined;
  kind?: MetricKind;
  hint?: ReactNode;
  delta?: number | null;
  goodDirection?: MetricGoodDirection;
  deltaInvert?: boolean;
  /** 1 = kuzey yıldızı, 2 = destek, 3 = detay */
  tier?: KpiTier;
  /** metric-descriptions anahtarı — (?) tooltip */
  metricKey?: string;
  /** Tier 1 sol şerit / üst aksan rengi (provider veya anlam). */
  accent?: string;
  sparkline?: ReactNode;
  className?: string;
}) {
  const def = metricKey ? metricDef(metricKey) : undefined;
  const desc = getMetricDescription(metricKey);
  const resolvedLabel = label ?? def?.label ?? desc?.title ?? "Metrik";
  const resolvedKind = kind ?? def?.kind ?? "count";
  const resolvedGood =
    goodDirection ?? def?.goodDirection ?? ("up" as MetricGoodDirection);

  const isUnknown =
    value == null ||
    value === "" ||
    value === "—" ||
    resolvedKind === "unknown";
  const invert = deltaInvert ?? deltaInvertFor(resolvedGood);
  const shell = TIER_SHELL[tier];
  const labelTone =
    KIND_LABEL_TONE[resolvedKind] ?? "text-panel-fg-secondary";
  const valueTone = KIND_VALUE_TONE[resolvedKind] ?? "text-panel-fg";
  const accentColor = accent ?? (tier === 1 ? "var(--panel-accent)" : undefined);

  return (
    <div
      className={[
        shell.radius,
        "relative overflow-visible border border-panel-border bg-panel-surface",
        tier === 1 ? "shadow-panel-md" : "shadow-panel",
        shell.pad,
        className,
      ].join(" ")}
      style={
        accentColor
          ? ({
              boxShadow:
                tier === 1
                  ? `inset 3px 0 0 ${accentColor}, var(--panel-shadow-md)`
                  : undefined,
            } as CSSProperties)
          : undefined
      }
    >
      {tier === 1 && accentColor ? (
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 opacity-80"
          style={{ background: accentColor }}
          aria-hidden
        />
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <div className={`flex items-center gap-1.5 ${shell.label} ${labelTone}`}>
          <span>{resolvedLabel}</span>
          {resolvedKind === "multiplier" ? (
            <span className="rounded bg-amber-50 px-1 py-0.5 text-[9px] font-bold tracking-wide text-amber-800 normal-case">
              ×
            </span>
          ) : null}
          <MetricHelpTooltip metricKey={metricKey} label={resolvedLabel} />
        </div>
      </div>

      {isUnknown ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-panel-unknown-bg text-panel-unknown">
            <X className="size-3.5" aria-hidden strokeWidth={2} />
          </span>
          <p className="text-base font-medium text-panel-unknown sm:text-lg">
            Kontrol edilemedi
          </p>
        </div>
      ) : (
        <p
          className={`mt-2.5 tabular-nums ${shell.value} ${valueTone}`}
        >
          {value}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!isUnknown && delta !== undefined && delta !== null ? (
          <DeltaBadge value={delta} invert={invert} />
        ) : null}
        {hint ? (
          <div className="text-xs text-panel-fg-secondary sm:text-sm">{hint}</div>
        ) : null}
      </div>

      {sparkline && !isUnknown ? (
        <div className="mt-3 h-8 opacity-80">{sparkline}</div>
      ) : null}
    </div>
  );
}

export function DeltaBadge({
  value,
  invert,
}: {
  value: number;
  invert?: boolean;
}) {
  const good = invert ? value < 0 : value > 0;
  const bad = invert ? value > 0 : value < 0;
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  const tone = good
    ? "bg-panel-ok-bg text-panel-ok"
    : bad
      ? "bg-panel-critical-bg text-panel-critical"
      : "bg-panel-surface-muted text-panel-fg-secondary";
  const sign = value > 0 ? "+" : "";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`}
    >
      <Icon className="size-3" aria-hidden strokeWidth={2.5} />
      {sign}
      {value.toFixed(1)}%
    </span>
  );
}
