"use client";

import Image from "next/image";
import Link from "next/link";
import { useScroll } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import HeroAsciiField from "./HeroAsciiField";
import HeroCopy from "./HeroCopy";
import MenuOverlay from "./MenuOverlay";

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [glitchSignal, setGlitchSignal] = useState(0);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const triggerGlitch = useCallback(
    () => setGlitchSignal((value) => value + 1),
    [],
  );

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[100svh] flex-col overflow-hidden"
    >
      <div className="hero-glow hero-rings pointer-events-none absolute inset-0" />
      <div className="hero-shifting-glows pointer-events-none absolute inset-0 overflow-hidden">
        <span className="hero-shifting-glow hero-shifting-glow-a" />
        <span className="hero-shifting-glow hero-shifting-glow-b" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 pb-28 pt-8 sm:px-8 lg:px-12 lg:pb-16 lg:pt-10">
        <div className="mb-10 flex items-start justify-between gap-6 sm:mb-14">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/593-logo.png"
              alt="593 EMarketing"
              width={44}
              height={44}
              className="h-10 w-10 object-contain sm:h-11 sm:w-11"
              priority
            />
            <span className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
              593 E-Marketing
            </span>
          </Link>

          <button
            type="button"
            aria-label="Menüyü aç"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent text-black transition-transform duration-300 hover:scale-[1.04] sm:h-12 sm:w-12"
          >
            <span className="flex flex-col gap-[5px]">
              <span className="block h-[2px] w-5 bg-black" />
              <span className="block h-[2px] w-5 bg-black" />
              <span className="block h-[2px] w-5 bg-black" />
            </span>
          </button>
        </div>

        <div className="grid flex-1 items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
          <HeroCopy onGlitch={triggerGlitch} />

          <div className="relative flex justify-start lg:justify-end">
            <HeroAsciiField
              glitchSignal={glitchSignal}
              scrollProgress={scrollYProgress}
            />
          </div>
        </div>

        <div className="relative mt-10 flex items-center lg:mt-6">
          <div className="h-px flex-1 bg-line" />
          <div className="relative mx-4 flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-accent/70 bg-black/40 sm:h-24 sm:w-24">
            <div className="animate-spin-slow absolute inset-0">
              <svg viewBox="0 0 100 100" className="h-full w-full">
                <defs>
                  <path
                    id="heroDividerCirclePath"
                    d="M 50, 50 m -36, 0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0"
                  />
                </defs>
                <text className="fill-accent text-[8px] font-medium uppercase tracking-[0.18em]">
                  <textPath href="#heroDividerCirclePath">
                    Keşfet · Keşfet · Keşfet · Keşfet ·
                  </textPath>
                </text>
              </svg>
            </div>
            <Image
              src="/593-logo.png"
              alt=""
              width={36}
              height={36}
              className="relative z-10 h-8 w-8 object-contain sm:h-9 sm:w-9"
            />
          </div>
          <div className="h-px flex-1 bg-line" />
        </div>
      </div>

      <MenuOverlay open={menuOpen} onClose={closeMenu} />
    </section>
  );
}
