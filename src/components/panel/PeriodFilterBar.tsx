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

export default function PeriodFilterBar({
  label,
}: {
  /** Resolved range label from server */
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const active = parsePanelPeriod(searchParams.get("period"));
  const start = searchParams.get("start") ?? "";
  const end = searchParams.get("end") ?? "";

  function go(period: PanelPeriod, custom?: { start: string; end: string }) {
    const href = buildPeriodHref(pathname || "/", {
      period,
      start: custom?.start,
      end: custom?.end,
    });
    startTransition(() => {
      router.push(href);
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => {
          const selected = active === p.period;
          return (
            <button
              key={p.period}
              type="button"
              disabled={pending}
              onClick={() => go(p.period)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                selected
                  ? "border-[#e91825]/40 bg-[#e91825]/10 text-[#e91825]"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
              } disabled:opacity-60`}
            >
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
          go("custom", { start: s, end: en });
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
          disabled={pending}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
            active === "custom"
              ? "border-[#e91825]/40 bg-[#e91825]/10 text-[#e91825]"
              : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
          } disabled:opacity-60`}
        >
          Uygula
        </button>
      </form>

      {label ? (
        <p className="w-full text-xs text-zinc-500 sm:w-auto">{label}</p>
      ) : null}
    </div>
  );
}
