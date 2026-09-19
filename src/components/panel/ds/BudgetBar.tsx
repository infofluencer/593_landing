import type { ReactNode } from "react";
import { formatTry } from "@/lib/panel/format";

/**
 * Bütçe temposu — gerçekleşen / (opsiyonel hedef).
 */
export function BudgetBar({
  realized,
  target,
  currency = "TRY",
}: {
  realized: number | null;
  target?: number | null;
  currency?: string;
}) {
  const hasRealized = realized != null;
  const hasTarget = target != null && target > 0;
  const max = Math.max(
    hasRealized ? realized! : 0,
    hasTarget ? target! : 0,
    1,
  );

  const realizedPct = hasRealized
    ? Math.min(100, Math.round((realized! / max) * 100))
    : 0;
  const targetPct = hasTarget
    ? Math.min(100, Math.round((target! / max) * 100))
    : null;

  const pace =
    hasTarget && hasRealized
      ? realized! / target!
      : null;
  const paceTone =
    pace == null
      ? null
      : pace > 1.1
        ? "text-panel-critical"
        : pace > 0.85
          ? "text-panel-warn"
          : "text-panel-ok";

  return (
    <section className="rounded-panel-lg border border-panel-border bg-panel-surface p-6 shadow-panel">
      <header className="mb-5">
        <h3 className="text-sm font-semibold text-panel-fg">Bütçe temposu</h3>
        <p className="mt-0.5 text-xs text-panel-fg-secondary">
          Gerçekleşen harcama
          {hasTarget ? " · hedef" : ""}
        </p>
      </header>

      {!hasRealized ? (
        <p className="text-sm text-panel-unknown">
          Kontrol edilemedi — harcama verisi yok.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat
              label="Gerçekleşen"
              value={formatTry(realized!, currency)}
            />
            <Stat
              label="Hedef"
              value={hasTarget ? formatTry(target!, currency) : "—"}
              muted={!hasTarget}
              extra={
                paceTone && pace != null ? (
                  <span className={`text-xs font-semibold tabular-nums ${paceTone}`}>
                    {(pace * 100).toFixed(0)}% tempo
                  </span>
                ) : null
              }
            />
          </div>

          <div className="relative mt-6 h-3 overflow-hidden rounded-full bg-panel-surface-muted">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-panel-fg"
              style={{ width: `${realizedPct}%` }}
              title="Gerçekleşen"
            />
            {targetPct != null ? (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-panel-accent"
                style={{ left: `${targetPct}%` }}
                title="Hedef"
              />
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-[10px] font-medium uppercase tracking-wide text-panel-fg-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-panel-fg" />
              Gerçekleşen
            </span>
            {hasTarget ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-0.5 bg-panel-accent" />
                Hedef
              </span>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  muted,
  extra,
}: {
  label: string;
  value: string;
  muted?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-panel-fg-secondary">
        {label}
      </p>
      <p
        className={[
          "mt-1 text-xl font-semibold tabular-nums tracking-tight",
          muted ? "text-panel-fg-muted" : "text-panel-fg",
        ].join(" ")}
      >
        {value}
      </p>
      {extra ? <div className="mt-1">{extra}</div> : null}
    </div>
  );
}
