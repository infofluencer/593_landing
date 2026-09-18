"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  buildPeriodHref,
  parsePanelPeriod,
  type PanelPeriod,
} from "@/lib/panel/period";

const PRESETS: { period: PanelPeriod; label: string }[] = [
  { period: "mtd", label: "Bu ay" },
  { period: "1", label: "1 ay" },
  { period: "3", label: "3 ay" },
  { period: "6", label: "6 ay" },
  { period: "12", label: "12 ay" },
  { period: "24", label: "720 gün" },
];

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const active = parsePanelPeriod(searchParams.get("period"));
  const start = searchParams.get("start") ?? "";
  const end = searchParams.get("end") ?? "";
  const compareOn = searchParams.get("compare") === "1";

  function pushHref(href: string) {
    startTransition(() => {
      router.push(href);
    });
  }

  function go(period: PanelPeriod, custom?: { start: string; end: string }) {
    let href = buildPeriodHref(pathname || "/", {
      period,
      start: custom?.start,
      end: custom?.end,
    });
    if (compareOn) {
      href += href.includes("?") ? "&compare=1" : "?compare=1";
    }
    pushHref(href);
  }

  function toggleCompare() {
    const next = new URLSearchParams(searchParams.toString());
    if (compareOn) next.delete("compare");
    else next.set("compare", "1");
    const qs = next.toString();
    pushHref(qs ? `${pathname}?${qs}` : pathname || "/");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => {
          const selected = active === p.period;
          return (
            <button
              key={p.period}
              type="button"
              disabled={pending}
              onClick={() => go(p.period)}
              className={[
                "rounded-panel-btn border px-2.5 py-1.5 text-xs font-medium transition",
                selected
                  ? "border-panel-accent/30 bg-panel-accent-soft text-panel-accent"
                  : "border-panel-border bg-panel-surface text-panel-fg-secondary hover:border-panel-border-strong hover:text-panel-fg",
                "disabled:opacity-60",
              ].join(" ")}
            >
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
            go("custom", { start: s, end: en });
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
            disabled={pending}
            className={[
              "rounded-panel-btn border px-2.5 py-1.5 text-xs font-medium",
              active === "custom"
                ? "border-panel-accent/30 bg-panel-accent-soft text-panel-accent"
                : "border-panel-border bg-panel-surface text-panel-fg-secondary hover:border-panel-border-strong",
              "disabled:opacity-60",
            ].join(" ")}
          >
            Uygula
          </button>
        </form>

        {showCompare ? (
          <button
            type="button"
            disabled={pending}
            onClick={toggleCompare}
            aria-pressed={compareOn}
            className={[
              "rounded-panel-btn border px-2.5 py-1.5 text-xs font-medium transition",
              compareOn
                ? "border-panel-accent/30 bg-panel-accent-soft text-panel-accent"
                : "border-panel-border bg-panel-surface text-panel-fg-secondary hover:border-panel-border-strong",
              "disabled:opacity-60",
            ].join(" ")}
          >
            Önceki dönemle karşılaştır
          </button>
        ) : null}
      </div>

      {label ? (
        <p className="text-xs text-panel-fg-secondary">{label}</p>
      ) : null}
    </div>
  );
}
