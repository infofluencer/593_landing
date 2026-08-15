"use client";

import { useEffect, useRef } from "react";

/**
 * Soft glass cursor — no hard border; sheen + light frost.
 * Desktop / fine pointer only.
 */
export default function CursorDot() {
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    if (!dot) return;

    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) {
      dot.style.display = "none";
      return;
    }

    document.documentElement.classList.add("has-cursor-dot");

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x;
    let ty = y;
    let visible = false;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!visible) {
        visible = true;
        x = tx;
        y = ty;
        dot.style.opacity = "1";
      }
    };

    const onLeave = () => {
      visible = false;
      dot.style.opacity = "0";
    };

    const tick = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      document.documentElement.classList.remove("has-cursor-dot");
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={dotRef}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-[9999] h-16 w-16 rounded-full opacity-0 transition-opacity duration-200 will-change-transform"
      style={{
        background: `
          radial-gradient(circle at 30% 24%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.12) 22%, rgba(255,255,255,0.04) 48%, rgba(255,255,255,0.015) 72%, transparent 100%)
        `,
        boxShadow: `
          inset 0 1.5px 1px rgba(255,255,255,0.35),
          inset 0 -10px 18px rgba(255,255,255,0.04),
          0 0 0 1px rgba(255,255,255,0.06),
          0 10px 28px rgba(0,0,0,0.12)
        `,
        backdropFilter: "blur(3px) saturate(1.2)",
        WebkitBackdropFilter: "blur(3px) saturate(1.2)",
      }}
    />
  );
}
