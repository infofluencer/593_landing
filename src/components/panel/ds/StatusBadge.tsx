import type { AlertSeverity } from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { HEALTH_LABEL } from "@/lib/panel/data";

const CONFIG: Record<
  AlertSeverity,
  {
    Icon: LucideIcon;
    className: string;
  }
> = {
  ok: {
    Icon: CheckCircle2,
    className:
      "bg-panel-ok-bg text-panel-ok border-panel-ok/20 border",
  },
  warn: {
    Icon: AlertTriangle,
    className:
      "bg-panel-warn-bg text-panel-warn border-panel-warn/25 border",
  },
  critical: {
    Icon: XCircle,
    className:
      "bg-panel-critical-bg text-panel-critical border-panel-critical/25 border",
  },
  unknown: {
    Icon: CircleHelp,
    className:
      "bg-panel-unknown-bg text-panel-unknown border-panel-border-strong border",
  },
};

/**
 * Durum rozeti. `reasons` verilirse rozet odaklanabilir olur; üstüne gelince /
 * tıklayınca sebepler açılır ("Google Ads 12 gündür harcama yok" gibi).
 * JS gerektirmez (hover + focus-within).
 */
export function StatusBadge({
  status,
  label,
  size = "md",
  reasons,
}: {
  status: AlertSeverity;
  label?: string;
  size?: "sm" | "md";
  reasons?: readonly string[];
}) {
  const { Icon, className } = CONFIG[status];
  const list = (reasons ?? []).filter((r) => r.trim().length > 0);
  const badgeClass = [
    "inline-flex items-center gap-1.5 font-semibold tracking-wide",
    size === "sm" ? "rounded-md px-1.5 py-0.5 text-[10px]" : "rounded-lg px-2 py-1 text-[11px]",
    className,
    list.length
      ? "cursor-help underline decoration-dotted decoration-current/40 underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-accent"
      : "",
  ].join(" ");
  const icon = (
    <Icon
      className={size === "sm" ? "size-3 shrink-0" : "size-3.5 shrink-0"}
      aria-hidden
      strokeWidth={2.25}
    />
  );
  const text = label ?? HEALTH_LABEL[status];

  if (list.length === 0) {
    return (
      <span className={badgeClass}>
        {icon}
        {text}
      </span>
    );
  }

  return (
    <span className="group relative inline-flex">
      <button type="button" className={badgeClass} title={list.join("\n")}>
        {icon}
        {text}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-30 mt-1.5 hidden w-72 rounded-panel-md border border-panel-border bg-panel-surface p-3 text-left shadow-panel group-focus-within:block group-hover:block"
      >
        <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-panel-fg-muted">
          Sebep
        </span>
        <ul className="mt-1.5 space-y-1">
          {list.map((r) => (
            <li
              key={r}
              className="text-xs font-normal normal-case leading-5 tracking-normal text-panel-fg"
            >
              {r}
            </li>
          ))}
        </ul>
      </span>
    </span>
  );
}
