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

export function StatusBadge({
  status,
  label,
  size = "md",
}: {
  status: AlertSeverity;
  label?: string;
  size?: "sm" | "md";
}) {
  const { Icon, className } = CONFIG[status];
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 font-semibold tracking-wide",
        size === "sm" ? "rounded-md px-1.5 py-0.5 text-[10px]" : "rounded-lg px-2 py-1 text-[11px]",
        className,
      ].join(" ")}
    >
      <Icon
        className={size === "sm" ? "size-3 shrink-0" : "size-3.5 shrink-0"}
        aria-hidden
        strokeWidth={2.25}
      />
      {label ?? HEALTH_LABEL[status]}
    </span>
  );
}
