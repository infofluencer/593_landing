import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";

export function ChartCard({
  title,
  description,
  children,
  empty,
  emptyVariant = "empty",
  className = "",
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  /** When true, show EmptyState instead of chart children. */
  empty?: boolean;
  emptyVariant?: "unknown" | "empty";
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-panel-lg border border-panel-border bg-panel-surface p-6 shadow-panel",
        className,
      ].join(" ")}
    >
      <header className="mb-5 space-y-1">
        <h3 className="text-sm font-semibold text-panel-fg">{title}</h3>
        {description ? (
          <p className="text-xs text-panel-fg-secondary">{description}</p>
        ) : null}
      </header>
      {empty ? (
        <EmptyState variant={emptyVariant} />
      ) : (
        <div className="min-h-[220px] w-full">{children}</div>
      )}
    </section>
  );
}

/** Shared recharts token colors for panel charts. */
export const PANEL_CHART = {
  grid: "rgba(28, 25, 23, 0.06)",
  tick: "#6b7280",
  tooltip: {
    background: "#ffffff",
    border: "1px solid #e7e5e4",
    borderRadius: 12,
    fontSize: 12,
    color: "#1a1a1a",
  },
  meta: "#0866ff",
  google: "#4285f4",
  accent: "#e91825",
  muted: "#a8a29e",
  series: ["#0866ff", "#4285f4", "#34a853", "#fbbc04", "#ea4335", "#78716c"],
} as const;
