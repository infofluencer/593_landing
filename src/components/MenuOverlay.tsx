"use client";

import Link from "next/link";
import { useEffect } from "react";

const links = [
  { href: "/", label: "Anasayfa" },
  { href: "#hizmetler", label: "Hizmetler" },
  { href: "#projeler", label: "Projeler" },
  { href: "#fiyat", label: "Fiyatlar" },
  { href: "#blog", label: "Blog" },
  { href: "#iletisim", label: "İletişim" },
];

type MenuOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export default function MenuOverlay({ open, onClose }: MenuOverlayProps) {
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="menu-overlay fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]">
      <div className="menu-overlay-glow pointer-events-none absolute inset-0" />

      <button
        type="button"
        aria-label="Menüyü kapat"
        onClick={onClose}
        className="absolute right-5 top-6 flex h-11 items-center gap-3 text-[13px] font-medium text-white transition-opacity hover:opacity-70 sm:right-8 sm:top-8"
      >
        Kapat
        <svg width="18" height="18" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <path
            d="M4 4L18 18M18 4L4 18"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <nav className="relative z-10 flex flex-col items-center gap-7 text-center sm:gap-8">
        {links.map((link, index) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onClose}
            className="menu-link font-display text-[clamp(2rem,7vw,4rem)] font-bold tracking-[-0.06em] text-white transition-colors duration-200 hover:text-accent"
            style={{ animationDelay: `${100 + index * 60}ms` }}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
