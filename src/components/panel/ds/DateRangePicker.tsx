"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  PeriodNavStatusLine,
  PeriodSpinner,
} from "@/components/panel/period-nav/PeriodNavUi";
import { usePeriodNavigation } from "@/components/panel/period-nav/usePeriodNavigation";
import {
  buildPeriodHref,
  PANEL_PERIOD_PRESETS,
  parsePanelPeriod,
  type PanelPeriod,
} from "@/lib/panel/period";

const PRESETS = PANEL_PERIOD_PRESETS;

/**
 * Tarih aralığı + önceki dönem karşılaştırma toggle.
 * compare=1 query param — sayfa verisi henüz bağlanmadıysa bile UI hazır.
 */
export function DateRangePicker({
  label,
  showCompare = true,
}: {
  label?: string;
  showCompare?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { navigate, busy, status, activeKey, label: navLabel } =
    usePeriodNavigation();
  const active = parsePanelPeriod(searchParams.get("period"));
  const start = searchParams.get("start") ?? "";
  const end = searchParams.get("end") ?? "";
  const compareOn = searchParams.get("compare") === "1";

  function go(
    period: PanelPeriod,
    navLabelText: string,
    custom?: { start: string; end: string },
  ) {
    let href = buildPeriodHref(pathname || "/", {
      period,
      start: custom?.start,
      end: custom?.end,
    });
    if (compareOn) {
      href += href.includes("?") ? "&compare=1" : "?compare=1";
    }
    navigate(href, { key: period, label: navLabelText });
  }

  function toggleCompare() {
    const next = new URLSearchParams(searchParams.toString());
    if (compareOn) next.delete("compare");
    else next.set("compare", "1");
    const qs = next.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname || "/", {
      key: "compare",
      label: compareOn ? "Karşılaştırmasız" : "Önceki dönemle karşılaştırma",
    });
  }

  return (
    <div className="flex flex-col gap-3" aria-busy={busy}>
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => {
          const selected = active === p.period;
          const loadingThis = busy && activeKey === p.period;
          return (
            <button
              key={p.period}
              type="button"
              disabled={busy}
              onClick={() => go(p.period, p.label)}
              className={[
                "inline-flex items-center gap-1.5 rounded-panel-btn border px-2.5 py-1.5 text-xs font-medium transition",
                selected || loadingThis
                  ? "border-panel-accent/30 bg-panel-accent-soft text-panel-accent"
                  : "border-panel-border bg-panel-surface text-panel-fg-secondary hover:border-panel-border-strong hover:text-panel-fg",
                loadingThis ? "disabled:opacity-100" : "disabled:opacity-60",
              ].join(" ")}
            >
              {loadingThis ? <PeriodSpinner /> : null}
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const s = String(fd.get("start") || "");
            const en = String(fd.get("end") || "");
            if (!s || !en) return;
            go("custom", "Özel aralık", { start: s, end: en });
          }}
        >
          <label className="text-[10px] font-semibold uppercase tracking-wide text-panel-fg-muted">
            Başlangıç
            <input
              name="start"
              type="date"
              defaultValue={active === "custom" ? start : ""}
              className="mt-1 block rounded-panel-btn border border-panel-border bg-panel-surface px-2.5 py-1.5 text-xs text-panel-fg"
            />
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-wide text-panel-fg-muted">
            Bitiş
            <input
              name="end"
              type="date"
              defaultValue={active === "custom" ? end : ""}
              className="mt-1 block rounded-panel-btn border border-panel-border bg-panel-surface px-2.5 py-1.5 text-xs text-panel-fg"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className={[
              "inline-flex items-center gap-1.5 rounded-panel-btn border px-2.5 py-1.5 text-xs font-medium",
              active === "custom" || (busy && activeKey === "custom")
                ? "border-panel-accent/30 bg-panel-accent-soft text-panel-accent"
                : "border-panel-border bg-panel-surface text-panel-fg-secondary hover:border-panel-border-strong",
              busy && activeKey === "custom"
                ? "disabled:opacity-100"
                : "disabled:opacity-60",
            ].join(" ")}
          >
            {busy && activeKey === "custom" ? <PeriodSpinner /> : null}
            Uygula
          </button>
        </form>

        {showCompare ? (
          <button
            type="button"
            disabled={busy}
            onClick={toggleCompare}
            aria-pressed={compareOn}
            className={[
              "inline-flex items-center gap-1.5 rounded-panel-btn border px-2.5 py-1.5 text-xs font-medium transition",
              compareOn
                ? "border-panel-accent/30 bg-panel-accent-soft text-panel-accent"
                : "border-panel-border bg-panel-surface text-panel-fg-secondary hover:border-panel-border-strong",
              busy && activeKey === "compare"
                ? "disabled:opacity-100"
                : "disabled:opacity-60",
            ].join(" ")}
          >
            {busy && activeKey === "compare" ? <PeriodSpinner /> : null}
            Önceki dönemle karşılaştır
          </button>
        ) : null}
      </div>

      {status === "idle" && label ? (
        <p className="text-xs text-panel-fg-secondary">{label}</p>
      ) : null}
      <PeriodNavStatusLine status={status} label={navLabel} />
    </div>
  );
}
