"use client";

import type { ReactNode } from "react";
import type { MetricGoodDirection, MetricKind } from "@/lib/panel/metric-kinds";
import { deltaInvertFor } from "@/lib/panel/metric-kinds";
import { DeltaBadge } from "./KPICard";
import { MetricHelpTooltip } from "./MetricHelpTooltip";

/**
 * Channel / section içi kompakt metrik hücresi (tier 2/3 hissi).
 */
export function MetricCell({
  label,
  value,
  kind = "count",
  hint,
  delta,
  goodDirection = "up",
  metricKey,
}: {
  label: string;
  value: string | null | undefined;
  kind?: MetricKind;
  hint?: ReactNode;
  delta?: number | null;
  goodDirection?: MetricGoodDirection;
  metricKey?: string;
}) {
  const isUnknown =
    value == null || value === "" || value === "—" || kind === "unknown";
  const invert = deltaInvertFor(goodDirection);
  const isMultiplier = kind === "multiplier";

  return (
    <div className="rounded-panel-md border border-panel-border/80 bg-panel-surface px-3.5 py-3 shadow-panel">
      <div
        className={[
          "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em]",
          isMultiplier ? "text-amber-800" : "text-panel-fg-secondary",
        ].join(" ")}
      >
        <span>{label}</span>
        {isMultiplier ? (
          <span className="text-[9px] font-bold normal-case">×</span>
        ) : null}
        <MetricHelpTooltip metricKey={metricKey} label={label} />
      </div>
      {isUnknown ? (
        <p className="mt-1.5 text-base font-medium text-panel-unknown">—</p>
      ) : (
        <p
          className={[
            "mt-1.5 text-lg font-semibold tabular-nums tracking-tight",
            isMultiplier ? "text-amber-800" : "text-panel-fg",
          ].join(" ")}
        >
          {value}
        </p>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {!isUnknown && delta != null ? (
          <>
            <DeltaBadge value={delta} invert={invert} />
            <span className="text-[10px] text-panel-fg-muted">önceki</span>
          </>
        ) : hint ? (
          <p className="text-[10px] leading-4 text-panel-fg-muted">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
