import type { AlertSeverity } from "@prisma/client";
import { HEALTH_LABEL } from "@/lib/panel/data";

const STYLES: Record<AlertSeverity, string> = {
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warn: "bg-amber-50 text-amber-800 ring-amber-200",
  critical: "bg-rose-50 text-rose-700 ring-rose-200",
  unknown: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

const DOT: Record<AlertSeverity, string> = {
  ok: "bg-emerald-400",
  warn: "bg-amber-400",
  critical: "bg-rose-400",
  unknown: "bg-slate-400",
};

export function StatusBadge({
  status,
  label,
}: {
  status: AlertSeverity;
  label?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-inset ${STYLES[status]}`}
    >
      <span className={`size-1.5 rounded-full ${DOT[status]}`} aria-hidden />
      {label ?? HEALTH_LABEL[status]}
    </span>
  );
}
