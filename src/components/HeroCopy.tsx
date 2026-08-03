"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const slides = [
  {
    eyebrow: "Doğru reklam, doğru hedef kitle",
    lines: ["593emarketing ile", "trafiğinizi satışa", "dönüştürün"],
    accentIndex: 1,
    cta: "Hemen başlayın",
  },
  {
    eyebrow: "Dijital pazarlama ajansınıza hoş geldiniz",
    lines: ["Dijital başarı için", "doğru strateji", "doğru tasarım"],
    accentIndex: 2,
    cta: "Başarıya adım atın",
  },
  {
    eyebrow: "Dijital dünyada yol arkadaşınız",
    lines: ["Dijitali tasarlıyoruz", "geleceği", "şekillendiriyoruz"],
    accentIndex: 2,
    cta: "İletişime geç",
  },
];

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M3 11L11 3M11 3H4.5M11 3V9.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Phase = "enter" | "still" | "shake" | "swap";

const phaseDurations: Record<Phase, number> = {
  enter: 280,
  still: 2400,
  shake: 900,
  swap: 420,
};

export default function HeroCopy({
  onGlitch,
}: {
  onGlitch?: () => void;
}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("enter");

  const slide = slides[slideIndex];
  const nextSlide = slides[(slideIndex + 1) % slides.length];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (phase === "enter") setPhase("still");
      else if (phase === "still") {
        onGlitch?.();
        setPhase("shake");
      } else if (phase === "shake") setPhase("swap");
      else {
        setSlideIndex((value) => (value + 1) % slides.length);
        setPhase("enter");
      }
    }, phaseDurations[phase]);

    return () => window.clearTimeout(timer);
  }, [phase, slideIndex, onGlitch]);

  return (
    <div className="relative max-w-2xl">
      <div
        key={slideIndex}
        className={`hero-copy ${
          phase === "enter"
            ? "is-enter"
            : phase === "still"
              ? "is-still"
              : phase === "shake"
                ? "is-shaking"
                : "is-swapping"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55 sm:text-[13px]">
          {slide.eyebrow}
        </p>

        <h1 className="mt-5 font-display text-[clamp(2rem,5.2vw,3.6rem)] font-bold leading-[1.02] tracking-tight">
          {slide.lines.map((line, index) => (
            <span
              key={line}
              className={`block ${
                index === slide.accentIndex ? "text-accent" : "text-white"
              }`}
            >
              {line}
            </span>
          ))}
        </h1>

        <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
          <Link
            href="#iletisim"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-black transition-all duration-300 hover:bg-[#f0452c] hover:shadow-[0_0_0_4px_var(--accent-soft)] sm:text-base"
          >
            {slide.cta}
            <ArrowIcon />
          </Link>
          <Link
            href="#projeler"
            className="inline-flex items-center gap-2 rounded-lg border border-accent/70 bg-transparent px-5 py-3 text-sm font-semibold text-white transition-all duration-300 hover:border-accent hover:bg-accent/10 sm:text-base"
          >
            Projeler
            <ArrowIcon />
          </Link>
        </div>
      </div>

      {phase === "swap" ? (
        <div className="hero-copy is-incoming pointer-events-none absolute inset-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55 sm:text-[13px]">
            {nextSlide.eyebrow}
          </p>

          <h1 className="mt-5 font-display text-[clamp(2rem,5.2vw,3.6rem)] font-bold leading-[1.02] tracking-tight">
            {nextSlide.lines.map((line, index) => (
              <span
                key={line}
                className={`block ${
                  index === nextSlide.accentIndex ? "text-accent" : "text-white"
                }`}
              >
                {line}
              </span>
            ))}
          </h1>

          <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-black sm:text-base">
              {nextSlide.cta}
              <ArrowIcon />
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-accent/70 px-5 py-3 text-sm font-semibold text-white sm:text-base">
              Projeler
              <ArrowIcon />
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
