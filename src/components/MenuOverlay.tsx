"use client";

import Link from "next/link";
import { useEffect } from "react";

const links = [
  { href: "/", label: "Anasayfa" },
  { href: "#ekibimiz", label: "Ekibimiz" },
  { href: "#hizmetlerimiz", label: "Hizmetlerimiz" },
  { href: "#projeler", label: "Projeler" },
  { href: "#iletisim", label: "İletişim" },
  { href: "#kariyer", label: "Kariyer" },
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
    <div className="menu-overlay fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="menu-overlay-glow pointer-events-none absolute inset-0" />

      <button
        type="button"
        aria-label="Menüyü kapat"
        onClick={onClose}
        className="absolute right-5 top-6 flex h-11 w-11 items-center justify-center text-white transition-opacity hover:opacity-70 sm:right-8 sm:top-8 lg:right-12"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <path
            d="M4 4L18 18M18 4L4 18"
            stroke="currentColor"
            strokeWidth="1.6"
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
            className="menu-link font-display text-[clamp(1.75rem,5vw,3.25rem)] font-semibold tracking-tight text-white transition-colors duration-200 hover:text-accent"
            style={{ animationDelay: `${120 + index * 70}ms` }}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
