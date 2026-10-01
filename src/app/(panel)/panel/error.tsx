"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { finishPeriodNav } from "@/components/panel/period-nav/store";

/**
 * Panel sayfası (ör. zaman filtresi değişince) sunucuda hata verirse.
 * Layout + menü yerinde kalır; yalnızca içerik bu kartla değişir.
 */
export default function PanelError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const hasPeriod =
    searchParams.has("period") ||
    searchParams.has("start") ||
    searchParams.has("end") ||
    searchParams.has("compare");

  useEffect(() => {
    finishPeriodNav();
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto max-w-lg rounded-panel-lg border border-[var(--panel-critical-border)] bg-panel-surface px-5 py-6 shadow-panel"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-panel-critical-bg text-panel-critical">
          <AlertTriangle className="h-4.5 w-4.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-panel-fg">
            Veriler yüklenemedi
          </h2>
          <p className="mt-1 text-sm leading-6 text-panel-fg-secondary">
            {hasPeriod
              ? "Seçilen dönemin verileri getirilirken bir hata oluştu."
              : "Bu sayfanın verileri getirilirken bir hata oluştu."}{" "}
            Tekrar deneyebilir ya da varsayılan döneme dönebilirsin.
          </p>
          {error.digest ? (
            <p className="mt-2 font-mono text-[11px] text-panel-fg-muted">
              Hata kodu: {error.digest}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="inline-flex items-center gap-1.5 rounded-panel-btn border border-panel-accent/30 bg-panel-accent-soft px-3 py-1.5 text-xs font-medium text-panel-accent hover:bg-panel-accent/15"
            >
              <RotateCw className="h-3.5 w-3.5" aria-hidden />
              Tekrar dene
            </button>
            {hasPeriod ? (
              <Link
                href={pathname}
                className="inline-flex items-center rounded-panel-btn border border-panel-border bg-panel-surface px-3 py-1.5 text-xs font-medium text-panel-fg-secondary hover:border-panel-border-strong hover:text-panel-fg"
              >
                Varsayılan döneme dön
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
