"use client";

import { useEffect, useState } from "react";
import ContactTrigger from "./ContactTrigger";

/**
 * Thumb-zone action bar for phones. Appears once the hero is behind you and
 * steps aside when the footer's own call-to-action arrives.
 */
export default function MobileActionDock() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let past = false;
    let atFooter = false;
    let raf = 0;

    const apply = () => setShown(past && !atFooter);

    const read = () => {
      raf = 0;
      const next = window.scrollY > window.innerHeight * 0.7;
      if (next === past) return;
      past = next;
      apply();
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };

    const footer = document.getElementById("site-footer");
    const io = footer
      ? new IntersectionObserver(
          ([entry]) => {
            atFooter = entry.isIntersecting;
            apply();
          },
          { rootMargin: "0px 0px -35% 0px" },
        )
      : null;
    if (footer && io) io.observe(footer);

    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      io?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      className={[
        "pointer-events-none fixed inset-x-0 bottom-0 z-30 md:hidden",
        "px-[max(var(--gutter),var(--safe-l))] pb-[max(0.75rem,var(--safe-b))]",
        "transition duration-300 ease-out",
        shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
      ].join(" ")}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-[#141111] via-[#141111]/85 to-transparent"
      />
      <div
        className={[
          "flex items-center gap-2.5",
          shown ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
      >
        <ContactTrigger className="flex min-h-[3.25rem] flex-1 items-center justify-center rounded-full bg-[#f4f1ea] px-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#141111] shadow-[0_16px_40px_-18px_rgba(0,0,0,0.9)] transition active:scale-[0.98] active:bg-[#e91825] active:text-white">
          Proje Başlat
        </ContactTrigger>
        <a
          href="https://wa.me/905435939533"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp ile yaz: +90 543 593 95 33"
          className="flex size-[3.25rem] shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#1c1818]/90 text-[#f4f1ea] backdrop-blur-xl transition active:scale-[0.98] active:border-[#e91825]/70"
        >
          <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
            <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.2 2.2Z" />
          </svg>
        </a>
      </div>
    </div>
  );
}
