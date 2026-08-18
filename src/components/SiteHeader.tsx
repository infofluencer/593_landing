"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { services } from "@/data/services";
import ContactTrigger from "./ContactTrigger";
import OutArrow from "./OutArrow";

export default function SiteHeader({
  floating = false,
}: {
  /** Set when the page draws its own content behind the bar (the home hero). */
  floating?: boolean;
}) {
  const pathname = usePathname();
  // Tracking the route the sheet was opened on lets a back/forward navigation
  // close it without a state-syncing effect.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt !== null && openedAt === pathname;
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpenedAt(null), []);

  useEffect(() => {
    let last = window.scrollY;
    let raf = 0;

    const read = () => {
      raf = 0;
      const y = window.scrollY;
      setScrolled(y > 16);
      // Reveal on any upward intent; hide only once clear of the hero.
      setHidden(y > 220 && y > last + 4);
      last = y;
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };

    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const root = document.documentElement;
    root.classList.add("nav-open");

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);

    const first = panelRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus({ preventScroll: true });
    const toggle = toggleRef.current;

    return () => {
      root.classList.remove("nav-open");
      document.removeEventListener("keydown", onKey);
      toggle?.focus({ preventScroll: true });
    };
  }, [open, close]);

  return (
    <>
      <header
        data-scrolled={scrolled ? "" : undefined}
        className={[
          "fixed inset-x-0 top-0 z-40 transition-transform duration-300 ease-out md:relative",
          hidden && !open ? "-translate-y-full md:translate-y-0" : "translate-y-0",
        ].join(" ")}
      >
        <div
          aria-hidden
          className={[
            "pointer-events-none absolute inset-0 border-b transition duration-300 md:hidden",
            scrolled && !open
              ? "border-white/10 bg-[#141111]/80 backdrop-blur-xl"
              : "border-transparent bg-transparent",
          ].join(" ")}
        />

        <div className="relative flex w-full items-center justify-between gap-3 pb-2 pl-[max(var(--gutter),var(--safe-l))] pr-[max(var(--gutter),var(--safe-r))] pt-[max(0.85rem,var(--safe-t))] md:pb-0 md:pt-[max(1rem,var(--safe-t))]">
          <Link
            href="/"
            onClick={close}
            className="-my-2 inline-flex min-h-11 items-center py-2 font-logo text-[clamp(1.15rem,5.2vw,2.1rem)] font-bold leading-none tracking-[-0.02em] text-[#f4f1ea] md:text-[clamp(1.35rem,3.4vw,2.1rem)] lg:my-0 lg:min-h-0 lg:py-0"
          >
            593 E-MARKETİNG
          </Link>

          <nav className="hidden items-center gap-5 md:flex lg:gap-7">
            <Link
              href="/hizmetlerimiz"
              className="inline-flex min-h-11 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f4f1ea] transition hover:text-[#e91825] lg:min-h-0 lg:border-b lg:border-[#f4f1ea]/70 lg:pb-0.5 lg:hover:border-[#e91825]"
            >
              Hizmetler
              <OutArrow className="size-3 text-current" />
            </Link>
            <ContactTrigger className="rounded-full bg-[#f4f1ea] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#141111] transition duration-300 hover:bg-[#e91825] hover:text-white lg:px-6 lg:py-3">
              İletişim
            </ContactTrigger>
          </nav>

          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpenedAt(open ? null : pathname)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
            className="-mr-1.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[#f4f1ea] transition active:scale-95 md:hidden"
          >
            <span aria-hidden className="relative block h-3.5 w-6">
              <span
                className={[
                  "absolute left-0 h-[2px] w-full rounded-full bg-current transition-all duration-300 ease-out",
                  open ? "top-1.5 rotate-45" : "top-0",
                ].join(" ")}
              />
              <span
                className={[
                  "absolute left-0 h-[2px] rounded-full bg-current transition-all duration-300 ease-out",
                  open ? "top-1.5 w-full -rotate-45" : "top-3 w-2/3",
                ].join(" ")}
              />
            </span>
          </button>
        </div>
      </header>

      {/* The bar is fixed on phones, so reserve its space in the flow. */}
      {floating ? null : (
        <div
          aria-hidden
          className="h-[max(4.25rem,calc(var(--safe-t)+3.4rem))] md:hidden"
        />
      )}

      {/* Mobile sheet */}
      <div
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Site menüsü"
        aria-hidden={!open}
        inert={!open}
        className={[
          "fixed inset-0 z-[35] flex flex-col bg-[#141111] transition duration-300 ease-out md:hidden",
          open ? "visible opacity-100" : "invisible opacity-0",
        ].join(" ")}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(233,24,37,0.18),transparent_58%)]"
        />

        <div
          ref={panelRef}
          className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-[max(var(--gutter),var(--safe-l))] pb-6 pt-[max(5rem,calc(var(--safe-t)+4.25rem))]"
        >
          <nav aria-label="Ana menü">
            <ul>
              {[{ label: "Hizmetler", href: "/hizmetlerimiz" }].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    className="flex items-center justify-between gap-4 border-b border-white/10 py-3.5 font-display text-[1.75rem] font-bold leading-none tracking-[-0.05em] text-[#f4f1ea] active:text-[#e91825]"
                  >
                    {item.label}
                    <OutArrow className="size-4 text-white/30" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
            Hizmetler
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {services.map((service) => (
              <li key={service.slug}>
                <Link
                  href={`/hizmetlerimiz/${service.slug}`}
                  onClick={close}
                  className="inline-flex min-h-11 items-center rounded-full border border-white/12 bg-white/[0.04] px-4 text-[13px] text-[#f4f1ea]/80 active:border-[#e91825]/60 active:text-[#f4f1ea]"
                >
                  {service.title}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-8">
            <div className="flex flex-col gap-2.5">
              <ContactTrigger
                onClick={close}
                className="flex min-h-[3.25rem] items-center justify-center rounded-full bg-[#f4f1ea] px-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#141111] transition active:bg-[#e91825] active:text-white"
              >
                Proje Başlat
              </ContactTrigger>
              <a
                href="https://wa.me/905435939533"
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[3.25rem] items-center justify-center rounded-full border border-white/15 px-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#f4f1ea] transition active:border-white/40"
              >
                +90 543 593 95 33
              </a>
            </div>

            <div className="mt-3 flex items-center gap-5 pb-[var(--safe-b)] text-[13px] text-white/40">
              <a
                href="https://www.instagram.com/593emarketing/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center"
              >
                Instagram
              </a>
              <a
                href="https://www.linkedin.com/company/593-emarketing"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center"
              >
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
