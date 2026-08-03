"use client";

import { useEffect, useRef, useState } from "react";
import Hero from "@/components/Hero";
import HeroAlt from "@/components/HeroAlt";

/**
 * Home page stacks both hero concepts for owner A/B:
 * 1) Concept B — ASCII field (eager)
 * 2) Concept A — Kinetic network (lazy-mounted near viewport)
 */
export default function Home() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [loadAlt, setLoadAlt] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || loadAlt) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoadAlt(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px 0px", threshold: 0.01 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [loadAlt]);

  return (
    <main className="min-h-full bg-bg">
      <Hero />

      {/* Triggers Concept A mount just before it enters view */}
      <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />

      {loadAlt ? (
        <HeroAlt />
      ) : (
        <div
          className="min-h-[100svh] w-full"
          aria-hidden="true"
        />
      )}
    </main>
  );
}
