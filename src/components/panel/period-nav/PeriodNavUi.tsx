"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { AlertTriangle, RotateCw, X } from "lucide-react";
import {
  finishPeriodNav,
  normalizeHref,
  usePeriodNavState,
  type PeriodNavStatus,
} from "./store";

/** Düğme içi küçük spinner. */
export function PeriodSpinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent ${className}`}
    />
  );
}

/** Filtrenin altında satır içi durum: yükleniyor / yavaş. */
export function PeriodNavStatusLine({
  status,
  label,
}: {
  status: PeriodNavStatus;
  label: string | null;
}) {
  if (status === "idle") return null;

  // Hata: PeriodNavIndicator sabit uyarıyı gösterir (filtre unmount olsa da görünür).
  if (status === "error") return null;

  return (
    <p
      role="status"
      aria-live="polite"
      className="flex w-full items-center gap-2 text-xs text-panel-fg-secondary"
    >
      <PeriodSpinner className="text-panel-accent" />
      {status === "slow"
        ? "Hâlâ yükleniyor — veri kaynakları yavaş yanıt veriyor…"
        : label
          ? `${label} verileri yükleniyor…`
          : "Veriler yükleniyor…"}
    </p>
  );
}

/**
 * PanelShell'de yaşar: üstte ilerleme çubuğu, yüklenemezse sabit uyarı.
 * URL hedefe ulaşınca (ya da sayfa değişince) durumu kapatır.
 */
export function PeriodNavIndicator() {
  const nav = usePeriodNavState();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  useEffect(() => {
    if (nav.status === "idle" || !nav.href) return;
    const current = qs ? `${pathname}?${qs}` : pathname;
    if (
      normalizeHref(current) === normalizeHref(nav.href) ||
      (nav.fromPath !== null && pathname !== nav.fromPath)
    ) {
      finishPeriodNav();
    }
  }, [pathname, qs, nav.status, nav.href, nav.fromPath]);

  const loading = nav.status === "loading" || nav.status === "slow";

  return (
    <>
      {loading ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-panel-accent-soft"
        >
          <div className="panel-progress-bar h-full w-1/3 bg-panel-accent" />
        </div>
      ) : null}

      {nav.status === "error" ? (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-panel-md border border-[var(--panel-critical-border)] bg-panel-surface px-4 py-3 shadow-panel-md sm:left-auto sm:right-4 sm:translate-x-0"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-panel-critical"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-panel-fg">
              Veriler yüklenemedi
            </p>
            <p className="mt-0.5 text-xs leading-5 text-panel-fg-secondary">
              {nav.label ? `“${nav.label}” dönemi` : "Seçilen dönem"} zamanında
              yanıt vermedi. Bağlantını kontrol edip tekrar deneyebilirsin.
            </p>
            <button
              type="button"
              onClick={() => nav.href && window.location.assign(nav.href)}
              className="mt-2 inline-flex items-center gap-1 rounded-panel-btn border border-panel-border bg-panel-surface px-2.5 py-1 text-xs font-medium text-panel-fg hover:border-panel-border-strong"
            >
              <RotateCw className="h-3 w-3" aria-hidden />
              Tekrar dene
            </button>
          </div>
          <button
            type="button"
            onClick={finishPeriodNav}
            aria-label="Kapat"
            className="rounded p-0.5 text-panel-fg-muted hover:text-panel-fg"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </>
  );
}
