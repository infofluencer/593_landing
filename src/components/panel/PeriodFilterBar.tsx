"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { PeriodNavStatusLine, PeriodSpinner } from "@/components/panel/period-nav/PeriodNavUi";
import { usePeriodNavigation } from "@/components/panel/period-nav/usePeriodNavigation";
import {
  buildPeriodHref,
  PANEL_PERIOD_PRESETS,
  parsePanelPeriod,
  type PanelPeriod,
} from "@/lib/panel/period";

const PRESETS = PANEL_PERIOD_PRESETS;

export default function PeriodFilterBar({
  label,
}: {
  /** Resolved range label from server */
  label?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { navigate, busy, status, activeKey, label: navLabel } =
    usePeriodNavigation();
  const active = parsePanelPeriod(searchParams.get("period"));
  const start = searchParams.get("start") ?? "";
  const end = searchParams.get("end") ?? "";

  function go(
    period: PanelPeriod,
    navLabelText: string,
    custom?: { start: string; end: string },
  ) {
    const href = buildPeriodHref(pathname || "/", {
      period,
      start: custom?.start,
      end: custom?.end,
    });
    navigate(href, { key: period, label: navLabelText });
  }

  return (
    <div
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
      aria-busy={busy}
    >
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => {
          const selected = active === p.period;
          const loadingThis = busy && activeKey === p.period;
          return (
            <button
              key={p.period}
              type="button"
              disabled={busy}
              onClick={() => go(p.period, p.label)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                selected || loadingThis
                  ? "border-[#e91825]/40 bg-[#e91825]/10 text-[#e91825]"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
              } ${loadingThis ? "disabled:opacity-100" : "disabled:opacity-60"}`}
            >
              {loadingThis ? <PeriodSpinner /> : null}
              {p.label}
            </button>
          );
        })}
      </div>

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
        <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Başlangıç
          <input
            name="start"
            type="date"
            defaultValue={active === "custom" ? start : ""}
            className="mt-0.5 block rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800"
          />
        </label>
        <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Bitiş
          <input
            name="end"
            type="date"
            defaultValue={active === "custom" ? end : ""}
            className="mt-0.5 block rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
            active === "custom" || (busy && activeKey === "custom")
              ? "border-[#e91825]/40 bg-[#e91825]/10 text-[#e91825]"
              : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
          } ${busy && activeKey === "custom" ? "disabled:opacity-100" : "disabled:opacity-60"}`}
        >
          {busy && activeKey === "custom" ? <PeriodSpinner /> : null}
          Uygula
        </button>
      </form>

      {status === "idle" && label ? (
        <p className="w-full text-xs text-zinc-500 sm:w-auto">{label}</p>
      ) : null}
      <PeriodNavStatusLine status={status} label={navLabel} />
    </div>
  );
}
