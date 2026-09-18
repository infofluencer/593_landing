import { formatNumber } from "@/lib/panel/format";

export type FunnelStep = {
  id: string;
  label: string;
  value: number | null;
  /** Opsiyonel para / ek satır */
  subValue?: string | null;
};

/**
 * E-ticaret satın alma hunisi.
 * value null → adım “—” (0 uydurma).
 */
export function FunnelCard({
  title = "Satın alma hunisi",
  steps,
  currencyNote,
}: {
  title?: string;
  steps: FunnelStep[];
  currencyNote?: string;
}) {
  const numeric = steps
    .map((s) => s.value)
    .filter((v): v is number => v != null && v > 0);
  const max = numeric.length ? Math.max(...numeric) : 0;
  const hasAny = steps.some((s) => s.value != null);

  return (
    <section className="rounded-panel-lg border border-panel-border bg-panel-surface p-6 shadow-panel">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-panel-fg">{title}</h3>
          {currencyNote ? (
            <p className="mt-0.5 text-xs text-panel-fg-secondary">
              {currencyNote}
            </p>
          ) : null}
        </div>
      </header>

      {!hasAny ? (
        <p className="text-sm text-panel-unknown">
          Kontrol edilemedi — huni adımları için veri yok.
        </p>
      ) : (
        <ul className="space-y-3">
          {steps.map((step) => {
            const known = step.value != null;
            const width =
              known && max > 0
                ? Math.max(8, Math.round((step.value! / max) * 100))
                : 0;
            return (
              <li key={step.id}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-panel-fg-secondary">
                    {step.label}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-panel-fg">
                    {known ? formatNumber(step.value!) : "—"}
                    {step.subValue ? (
                      <span className="ml-2 text-xs font-normal text-panel-fg-muted">
                        {step.subValue}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-panel-surface-muted">
                  {known && step.value! > 0 ? (
                    <div
                      className="h-full rounded-full bg-panel-fg/80 transition-[width] duration-300"
                      style={{ width: `${width}%` }}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
