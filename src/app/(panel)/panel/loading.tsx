import PanelLoadingBlock from "@/components/panel/PanelLoadingBlock";

/** Instant feedback while the next panel page RSC stream resolves. */
export default function PanelLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-panel-surface-muted" />
        <div className="h-7 w-48 animate-pulse rounded bg-panel-surface-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-panel-surface-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-panel-lg border border-panel-border bg-panel-surface-muted/60"
          />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-panel-md border border-panel-border bg-panel-surface-muted/50"
          />
        ))}
      </div>
      <PanelLoadingBlock
        title="Sayfa yükleniyor"
        detail="Veriler hazırlanıyor — menüden ayrılmana gerek yok."
      />
    </div>
  );
}
