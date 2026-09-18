import type { ReactNode } from "react";
import { CircleHelp, Inbox } from "lucide-react";

export function EmptyState({
  variant = "empty",
  title,
  description,
  action,
}: {
  /** unknown = "Kontrol edilemedi" (no data ≠ zero). empty = no rows. */
  variant?: "unknown" | "empty";
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  const isUnknown = variant === "unknown";
  const Icon = isUnknown ? CircleHelp : Inbox;
  const resolvedTitle =
    title ?? (isUnknown ? "Kontrol edilemedi" : "Veri yok");
  const resolvedDesc =
    description ??
    (isUnknown
      ? "Bu metrik henüz doğrulanamadı. Sıfır veya boş grafik anlamına gelmez."
      : "Bu dönem için gösterilecek kayıt bulunmuyor.");

  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center rounded-panel-md border border-dashed border-panel-border-strong bg-panel-surface-muted/60 px-6 py-12 text-center"
    >
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-panel-surface text-panel-fg-muted">
        <Icon className="size-5" aria-hidden strokeWidth={1.75} />
      </span>
      <p className="text-sm font-semibold text-panel-fg">{resolvedTitle}</p>
      <p className="mt-1.5 max-w-sm text-sm text-panel-fg-secondary">
        {resolvedDesc}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
