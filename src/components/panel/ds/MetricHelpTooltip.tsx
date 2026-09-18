"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import {
  getMetricDescription,
  type MetricDescription,
} from "@/lib/panel/metric-descriptions";

/**
 * KPI / tablo başlığı (?) tooltip — hover, focus, tap.
 * document.body portal + fixed: kart overflow / tablo scroll kesmez.
 */
export function MetricHelpTooltip({
  metricKey,
  title,
  description,
  formula,
  label,
}: {
  metricKey?: string | null;
  title?: string;
  description?: string;
  formula?: string;
  label?: string;
}) {
  const fromDict = getMetricDescription(metricKey);
  const content: MetricDescription | null =
    title || description
      ? {
          title: title ?? fromDict?.title ?? label ?? "Açıklama",
          description: description ?? fromDict?.description ?? "",
          formula: formula ?? fromDict?.formula,
        }
      : fromDict;

  if (!content?.description) return null;

  return (
    <HelpTooltip
      ariaLabel={`${content.title} hakkında`}
      title={content.title}
      description={content.description}
      formula={content.formula}
    />
  );
}

function HelpTooltip({
  ariaLabel,
  title,
  description,
  formula,
}: {
  ariaLabel: string;
  title: string;
  description: string;
  formula?: string;
}) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const clearClose = useCallback(() => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const closeSoon = useCallback(() => {
    clearClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  }, [clearClose]);

  const openNow = useCallback(() => {
    clearClose();
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const tipW = 256;
    const gap = 10;
    let left = r.left + r.width / 2 - tipW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
    // İkonun altında — fare ikondayken boşluk yok, kesilmez
    const top = Math.min(r.bottom + gap, window.innerHeight - 8);
    setPos({ top, left });
    setOpen(true);
  }, [clearClose]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || tipRef.current?.contains(t)) {
        return;
      }
      setOpen(false);
    };
    const onScroll = () => setOpen(false);

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => () => clearClose(), [clearClose]);

  return (
    <span className="relative inline-flex shrink-0 align-middle">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex size-4 items-center justify-center rounded-full text-panel-fg-muted transition hover:text-panel-fg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-accent"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
        onFocus={openNow}
        onBlur={closeSoon}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) {
            setOpen(false);
          } else {
            openNow();
          }
        }}
      >
        <HelpCircle className="size-3.5" aria-hidden strokeWidth={2} />
      </button>

      {mounted && open
        ? createPortal(
            <div
              ref={tipRef}
              id={tipId}
              role="tooltip"
              className="fixed z-[9999] w-64 rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-lg"
              style={{ top: pos.top, left: pos.left }}
              onMouseEnter={clearClose}
              onMouseLeave={closeSoon}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-900">
                {title}
              </p>
              <p className="mt-1.5 text-xs font-normal leading-relaxed text-zinc-600">
                {description}
              </p>
              {formula ? (
                <p className="mt-2 rounded-md bg-zinc-100 px-2 py-1.5 text-[11px] font-normal leading-snug text-zinc-800">
                  <span className="font-semibold text-zinc-500">
                    Hesaplama ·{" "}
                  </span>
                  {formula}
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

/** Tablo başlığı + (?) yan yana. */
export function MetricHeaderLabel({
  children,
  metricKey,
  className = "",
}: {
  children: ReactNode;
  metricKey?: string | null;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {children}
      <MetricHelpTooltip metricKey={metricKey} />
    </span>
  );
}
