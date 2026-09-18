"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Settings } from "lucide-react";

/**
 * Marka ayarları — girişte kapalı; Ayarlar / #ayarlar ile açılır.
 */
export default function BrandSettingsDisclosure({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const syncFromHash = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#ayarlar") {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [syncFromHash]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    if (window.location.hash === "#ayarlar") {
      requestAnimationFrame(() => {
        document.getElementById("ayarlar")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [open]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        if (next) {
          window.history.replaceState(null, "", "#ayarlar");
        } else if (window.location.hash === "#ayarlar") {
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}`,
          );
        }
      }
      return next;
    });
  }

  return (
    <section
      id="ayarlar"
      className="scroll-mt-24 rounded-xl border border-zinc-200 bg-white"
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-4 text-left sm:px-6"
      >
        <Settings className="size-4 shrink-0 text-zinc-400" aria-hidden />
        <div className="mr-auto min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900">Ayarlar</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Meta act_ + Google ID’ler + müşteri + eşikler + silme
          </p>
        </div>
        <ChevronDown
          className={[
            "size-4 shrink-0 text-zinc-400 transition",
            open ? "rotate-180" : "",
          ].join(" ")}
          aria-hidden
        />
        <span className="text-xs font-medium text-[#e91825]">
          {open ? "Gizle" : "Aç"}
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-zinc-100 px-4 py-5 sm:px-6 sm:py-6">
          {children}
        </div>
      ) : null}
    </section>
  );
}
