"use client";

/**
 * Tunable constants for the ASCII crystallization field.
 * CELL_SIZE          desktop glyph cell size in CSS px (mobile uses MOBILE_CELL)
 * GLYPH_SET          idle noise character pool
 * CURSOR_RADIUS      px radius — keep small so only ONE word wakes
 * NOISE_SPEED        breath / red-bloom travel speed
 * FALL_GAIN          how hard glyphs rain as scrollProgress → 1
 * GLITCH_MS          duration of RGB tear + scanline flash
 * PILL_BG_ALPHA      solid chip background alpha over the field
 * PILL_BORDER        chip border color
 * FIELD_SAFE_MARGIN  inner margin so the pill never leaves the field
 * WORD_MAX_FONT      max font size (px) before fit-to-width shrink
 * REVEAL_MS          pill fade+rise + underline sweep
 * DISSOLVE_MS        fade out
 * ANCHORS[]          service labels + relative field positions (0–1)
 *
 * Words float as a compact PILL chip ABOVE the noise. The field is never
 * carved/dimmed; the pill is contained inside overflow:hidden bounds.
 */
const CELL_SIZE = 14;
const MOBILE_CELL = 18;
const CURSOR_RADIUS = 88;
const NOISE_SPEED = 0.00055;
const FALL_GAIN = 2.8;
const GLITCH_MS = 300;
const PILL_BG_ALPHA = 0.82;
const PILL_BORDER = "rgba(224,56,32,0.6)";
const FIELD_SAFE_MARGIN = 24;
const WORD_MAX_FONT = 24;
const WORD_MIN_FONT = 14;
const UNDERLINE_COLOR = "#E03820";
const REVEAL_MS = 300;
const DISSOLVE_MS = 350;
const GLYPH_SET =
  "593▚▞░▒▓/\\|<>{}[]—•·+=×dijitalpazarlamawebuxseostratejisoyalmedyakreatificerikinfofluencer";

const ANCHORS = [
  { label: "Dijital Pazarlama", x: 0.28, y: 0.22 },
  { label: "Web & UI/UX", x: 0.72, y: 0.2 },
  { label: "SEO & Strateji", x: 0.3, y: 0.48 },
  { label: "Sosyal Medya", x: 0.55, y: 0.5 },
  { label: "Kreatif İçerik", x: 0.32, y: 0.76 },
  { label: "Infofluencer", x: 0.68, y: 0.78 },
] as const;

import { type MotionValue } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

type Anchor = (typeof ANCHORS)[number];

type Cell = {
  ch: string;
  fall: number;
};

type HeroAsciiFieldProps = {
  glitchSignal?: number;
  /** 0–1 scroll progress of the hero section (from useScroll). */
  scrollProgress?: MotionValue<number>;
  className?: string;
};

function noise2(x: number, y: number, t: number) {
  return (
    Math.sin(x * 0.11 + t * 1.1) * 0.5 +
    Math.sin(y * 0.13 - t * 0.9) * 0.35 +
    Math.sin((x + y) * 0.07 + t * 0.6) * 0.25 +
    Math.sin(x * 0.03 - y * 0.05 + t * 1.7) * 0.2
  );
}

function pickGlyph() {
  return GLYPH_SET[(Math.random() * GLYPH_SET.length) | 0];
}

function nearestAnchor(px: number, py: number, w: number, h: number) {
  let best: Anchor | null = null;
  let bestDist = Infinity;
  for (const anchor of ANCHORS) {
    const ax = anchor.x * w;
    const ay = anchor.y * h;
    const d = Math.hypot(px - ax, py - ay);
    if (d < bestDist) {
      bestDist = d;
      best = anchor;
    }
  }
  return { anchor: best, dist: bestDist };
}

function FloatingWord({
  anchor,
  index,
  visible,
  dissolving,
  reduced,
  fieldWidth,
  fieldHeight,
}: {
  anchor: Anchor;
  index: number;
  visible: boolean;
  dissolving: boolean;
  reduced: boolean;
  fieldWidth: number;
  fieldHeight: number;
}) {
  const pillRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(
    Math.min(
      WORD_MAX_FONT,
      Math.max(WORD_MIN_FONT, fieldWidth * 0.045 || WORD_MAX_FONT),
    ),
  );
  const [pos, setPos] = useState(() => ({
    left: Math.min(
      fieldWidth - FIELD_SAFE_MARGIN,
      Math.max(FIELD_SAFE_MARGIN, anchor.x * fieldWidth),
    ),
    top: Math.min(
      fieldHeight - FIELD_SAFE_MARGIN,
      Math.max(FIELD_SAFE_MARGIN, anchor.y * fieldHeight),
    ),
  }));
  const idx = String(index + 1).padStart(2, "0");
  const phaseClass = dissolving
    ? "is-dissolving"
    : visible
      ? "is-revealing"
      : "is-hidden";

  useEffect(() => {
    if (!fieldWidth || !fieldHeight) return;

    const maxPillW = Math.max(120, fieldWidth - FIELD_SAFE_MARGIN * 2);
    let size = Math.min(
      WORD_MAX_FONT,
      Math.max(WORD_MIN_FONT, fieldWidth * 0.045),
    );

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const label = `${idx} — ${anchor.label}`;
    for (let i = 0; i < 16; i++) {
      ctx.font = `600 ${size}px Syne, sans-serif`;
      const pillW = ctx.measureText(label).width + 28;
      if (pillW <= maxPillW || size <= WORD_MIN_FONT) break;
      size -= 1;
    }
    setFontSize(size);

    ctx.font = `600 ${size}px Syne, sans-serif`;
    const pillW = ctx.measureText(label).width + 28;
    const pillH = size + 22;

    let left = anchor.x * fieldWidth;
    let top = anchor.y * fieldHeight;
    const halfW = pillW / 2;
    const halfH = pillH / 2;
    left = Math.min(
      fieldWidth - FIELD_SAFE_MARGIN - halfW,
      Math.max(FIELD_SAFE_MARGIN + halfW, left),
    );
    top = Math.min(
      fieldHeight - FIELD_SAFE_MARGIN - halfH,
      Math.max(FIELD_SAFE_MARGIN + halfH, top),
    );
    setPos({ left, top });

    requestAnimationFrame(() => {
      const el = pillRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const hw = rect.width / 2;
      const hh = rect.height / 2;
      setPos((prev) => ({
        left: Math.min(
          fieldWidth - FIELD_SAFE_MARGIN - hw,
          Math.max(FIELD_SAFE_MARGIN + hw, prev.left),
        ),
        top: Math.min(
          fieldHeight - FIELD_SAFE_MARGIN - hh,
          Math.max(FIELD_SAFE_MARGIN + hh, prev.top),
        ),
      }));
    });
  }, [anchor, fieldWidth, fieldHeight, idx]);

  return (
    <div
      ref={pillRef}
      className={`ascii-pill pointer-events-none absolute z-20 ${phaseClass} ${
        reduced ? "is-reduced" : ""
      }`}
      style={{
        left: pos.left,
        top: pos.top,
        transform: "translate(-50%, -50%)",
        ["--reveal-ms" as string]: `${REVEAL_MS}ms`,
        ["--dissolve-ms" as string]: `${DISSOLVE_MS}ms`,
        ["--pill-bg" as string]: `rgba(5,5,5,${PILL_BG_ALPHA})`,
        ["--pill-border" as string]: PILL_BORDER,
        fontSize,
      }}
      aria-hidden={!visible && !dissolving}
    >
      <div className="ascii-pill-inner whitespace-nowrap">
        <span className="ascii-pill-index font-display font-semibold tracking-[0.08em] text-[#E03820]">
          {idx} —
        </span>{" "}
        <span className="ascii-pill-label font-display font-semibold tracking-[0.03em] text-white">
          {anchor.label}
        </span>
        <span
          className="ascii-pill-underline mt-1.5 block h-[2px] origin-left"
          style={{ backgroundColor: UNDERLINE_COLOR }}
        >
          <span className="block h-px w-full translate-y-px bg-white/90" />
        </span>
      </div>
    </div>
  );
}

export default function HeroAsciiField({
  glitchSignal = 0,
  scrollProgress,
  className = "",
}: HeroAsciiFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cellsRef = useRef<Cell[]>([]);
  const colsRef = useRef(0);
  const rowsRef = useRef(0);
  const cellSizeRef = useRef(CELL_SIZE);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const scrollRef = useRef(0);
  const reducedRef = useRef(false);
  const mobileRef = useRef(false);
  const rafRef = useRef(0);
  const glitchUntilRef = useRef(0);
  const autoIndexRef = useRef(0);
  const dissolveTimerRef = useRef<number | null>(null);

  const [activeAnchor, setActiveAnchor] = useState<Anchor | null>(null);
  const [displayAnchor, setDisplayAnchor] = useState<Anchor | null>(null);
  const [dissolving, setDissolving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [fieldSize, setFieldSize] = useState({ w: 0, h: 0 });
  const mouseRaf = useRef(0);

  useEffect(() => {
    if (!scrollProgress) return;
    scrollRef.current = scrollProgress.get();
    return scrollProgress.on("change", (v) => {
      scrollRef.current = Math.max(0, Math.min(1, v));
    });
  }, [scrollProgress]);

  useEffect(() => {
    if (!glitchSignal) return;
    glitchUntilRef.current = performance.now() + GLITCH_MS;
  }, [glitchSignal]);

  useEffect(() => {
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqMobile = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      reducedRef.current = mqMotion.matches;
      mobileRef.current = mqMobile.matches;
      setReduced(mqMotion.matches);
      setIsMobile(mqMobile.matches);
    };
    sync();
    mqMotion.addEventListener("change", sync);
    mqMobile.addEventListener("change", sync);
    return () => {
      mqMotion.removeEventListener("change", sync);
      mqMobile.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (reduced) {
      setActiveAnchor(ANCHORS[0]);
      setDisplayAnchor(ANCHORS[0]);
      setDissolving(false);
      return;
    }

    if (!isMobile) return;

    const tick = () => {
      autoIndexRef.current = (autoIndexRef.current + 1) % ANCHORS.length;
      setActiveAnchor(ANCHORS[autoIndexRef.current]);
    };
    setActiveAnchor(ANCHORS[autoIndexRef.current]);
    const id = window.setInterval(tick, 2200);
    return () => window.clearInterval(id);
  }, [isMobile, reduced]);

  const shownRef = useRef<Anchor | null>(null);

  useEffect(() => {
    if (dissolveTimerRef.current) {
      window.clearTimeout(dissolveTimerRef.current);
      dissolveTimerRef.current = null;
    }

    if (activeAnchor) {
      shownRef.current = activeAnchor;
      setDisplayAnchor(activeAnchor);
      setDissolving(false);
      return;
    }

    if (!shownRef.current) return;

    setDissolving(true);
    dissolveTimerRef.current = window.setTimeout(() => {
      shownRef.current = null;
      setDisplayAnchor(null);
      setDissolving(false);
    }, DISSOLVE_MS);

    return () => {
      if (dissolveTimerRef.current) {
        window.clearTimeout(dissolveTimerRef.current);
      }
    };
  }, [activeAnchor]);

  const rebuildGrid = useCallback((width: number, height: number) => {
    const size = mobileRef.current ? MOBILE_CELL : CELL_SIZE;
    cellSizeRef.current = size;
    const cols = Math.max(8, Math.floor(width / size));
    const rows = Math.max(8, Math.floor(height / size));
    colsRef.current = cols;
    rowsRef.current = rows;
    const total = cols * rows;
    const prev = cellsRef.current;
    cellsRef.current = Array.from({ length: total }, (_, i) => {
      const old = prev[i];
      return old ?? { ch: pickGlyph(), fall: 0 };
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuildGrid(width, height);
      setFieldSize({ w: width, h: height });
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const draw = (time: number) => {
      const cols = colsRef.current;
      const rows = rowsRef.current;
      const size = cellSizeRef.current;
      const cells = cellsRef.current;
      const reducedMotion = reducedRef.current;
      const scroll = scrollRef.current;
      const pointer = pointerRef.current;

      ctx.clearRect(0, 0, width, height);

      const t = time * NOISE_SPEED;
      const fallBoost = reducedMotion ? 0 : scroll * FALL_GAIN;
      const mutateBudget = Math.floor(cells.length * 0.03);

      if (!reducedMotion) {
        for (let n = 0; n < mutateBudget; n++) {
          const i = (Math.random() * cells.length) | 0;
          cells[i].ch = pickGlyph();
        }
      }

      ctx.font = `${size - 2}px ui-monospace, "DM Mono", Menlo, monospace`;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      const px = pointer.active ? pointer.x : -9999;
      const py = pointer.active ? pointer.y : -9999;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const cell = cells[i];
          const x = c * size;
          const y = r * size;
          const cx = x + size * 0.5;
          const cy = y + size * 0.5;

          const dist = Math.hypot(cx - px, cy - py);
          const inCursor = !reducedMotion && dist < CURSOR_RADIUS;
          const n = noise2(c, r, t);
          const breath = 0.25 + (n + 1) * 0.2;
          const redBloom =
            Math.max(0, Math.sin(t * 2.2 + c * 0.08 - r * 0.06)) * 0.35;

          if (!reducedMotion) {
            cell.fall += fallBoost * (0.4 + Math.random() * 0.8);
            if (cell.fall > size * 1.2) {
              cell.fall = 0;
              cell.ch = pickGlyph();
            }
          }

          const drawY = y + cell.fall;
          let alpha = 0.35 + breath * 0.45;
          if (inCursor) alpha = Math.min(1, alpha + 0.25);

          if (redBloom > 0.2) {
            ctx.fillStyle = `rgba(224, 56, 32, ${redBloom * 0.55})`;
          } else {
            ctx.fillStyle = `rgba(245, 245, 245, ${alpha})`;
          }
          ctx.fillText(cell.ch, x + 1, drawY + 1);
        }
      }

      if (performance.now() < glitchUntilRef.current) {
        const amp = 2 + Math.random() * 2;
        try {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.drawImage(
            canvas,
            Math.round(amp * (window.devicePixelRatio || 1)),
            0,
          );
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = "rgba(0, 220, 255, 0.12)";
          ctx.fillRect(amp, 1, width, height);
          ctx.restore();
        } catch {
          // ignore
        }
        ctx.fillStyle = "rgba(224, 56, 32, 0.07)";
        for (let y = 0; y < height; y += 3) {
          ctx.fillRect(0, y, width, 1);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [rebuildGrid]);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMobile || reduced) return;
      const clientX = event.clientX;
      const clientY = event.clientY;
      if (mouseRaf.current) return;
      mouseRaf.current = requestAnimationFrame(() => {
        mouseRaf.current = 0;
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        pointerRef.current = { x, y, active: true };

        const near = nearestAnchor(x, y, rect.width, rect.height);
        if (near.anchor && near.dist < CURSOR_RADIUS) {
          setActiveAnchor((current) =>
            current?.label === near.anchor!.label ? current : near.anchor,
          );
        } else {
          setActiveAnchor(null);
        }
      });
    },
    [isMobile, reduced],
  );

  const onPointerLeave = useCallback(() => {
    pointerRef.current.active = false;
    if (!isMobile && !reduced) setActiveAnchor(null);
  }, [isMobile, reduced]);

  const shownIndex = displayAnchor
    ? ANCHORS.findIndex((a) => a.label === displayAnchor.label)
    : -1;

  return (
    <div
      ref={containerRef}
      className={`relative isolate aspect-square min-h-[min(70vw,600px)] w-full max-w-[560px] overflow-hidden ${className}`}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      role="img"
      aria-label={
        displayAnchor
          ? `593 hizmet alanı: ${displayAnchor.label}`
          : "593 EMarketing ASCII hizmet alanı"
      }
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      />

      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        {displayAnchor && shownIndex >= 0 && fieldSize.w > 0 ? (
          <FloatingWord
            key={displayAnchor.label}
            anchor={displayAnchor}
            index={shownIndex}
            visible={!!activeAnchor && !dissolving}
            dissolving={dissolving}
            reduced={reduced}
            fieldWidth={fieldSize.w}
            fieldHeight={fieldSize.h}
          />
        ) : null}
      </div>

      <ul className="sr-only">
        {ANCHORS.map((a) => (
          <li key={a.label}>{a.label}</li>
        ))}
      </ul>
    </div>
  );
}
