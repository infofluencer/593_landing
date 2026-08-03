"use client";

/**
 * CONCEPT A — Kinetic word mass + red thread network
 * Used as the second hero (HeroAlt) for owner A/B comparison vs Concept B (ASCII).
 */

import {
  motion,
  useMotionValue,
  useSpring,
  type MotionValue,
} from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Tunable constants — adjust the feel of the network + magnetic words here.
 * NODE_COUNT      desktop node count (mobile uses MOBILE_NODE_COUNT)
 * CONNECT_DIST    max distance (px) to draw an edge between nodes
 * REPEL_RADIUS    cursor radius that pushes kinetic words away
 * ATTRACT_RADIUS  cursor radius that pulls nodes toward the pointer
 * PULSE_INTERVAL  ms between signal pulses along random edges
 */
const NODE_COUNT = 40;
const MOBILE_NODE_COUNT = 20;
const CONNECT_DIST = 140;
const REPEL_RADIUS = 140;
const ATTRACT_RADIUS = 160;
const PULSE_INTERVAL = 2000;
const ACCENT = "#E03820";

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
};

type Pulse = {
  a: number;
  b: number;
  t: number;
};

type ServiceWord = {
  label: string;
  x: string;
  y: string;
  size: string;
  rotate: number;
};

const SERVICES: ServiceWord[] = [
  {
    label: "Dijital Pazarlama",
    x: "4%",
    y: "8%",
    size: "clamp(1.5rem, 2.6vw, 2.5rem)",
    rotate: -3,
  },
  {
    label: "Web & UI/UX",
    x: "58%",
    y: "6%",
    size: "clamp(1.2rem, 2.1vw, 1.9rem)",
    rotate: 4,
  },
  {
    label: "SEO & Strateji",
    x: "6%",
    y: "36%",
    size: "clamp(1.35rem, 2.3vw, 2.15rem)",
    rotate: -2,
  },
  {
    label: "Sosyal Medya",
    x: "62%",
    y: "40%",
    size: "clamp(1.15rem, 2vw, 1.85rem)",
    rotate: 3,
  },
  {
    label: "Kreatif İçerik",
    x: "8%",
    y: "72%",
    size: "clamp(1.25rem, 2.2vw, 2rem)",
    rotate: -4,
  },
  {
    label: "Infofluencer",
    x: "48%",
    y: "76%",
    size: "clamp(1.35rem, 2.3vw, 2.15rem)",
    rotate: 2,
  },
];

function createNodes(count: number, width: number, height: number): Node[] {
  return Array.from({ length: count }, () => {
    const x = Math.random() * width;
    const y = Math.random() * height;
    return {
      x,
      y,
      baseX: x,
      baseY: y,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
    };
  });
}

function KineticWord({
  word,
  cursorX,
  cursorY,
  interactive,
  dimmed,
  onHoverChange,
}: {
  word: ServiceWord;
  cursorX: MotionValue<number>;
  cursorY: MotionValue<number>;
  interactive: boolean;
  dimmed: boolean;
  onHoverChange: (label: string | null) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [localGlitch, setLocalGlitch] = useState(false);
  const offsetX = useSpring(0, { stiffness: 150, damping: 15 });
  const offsetY = useSpring(0, { stiffness: 150, damping: 15 });
  const autoX = useSpring(0, { stiffness: 40, damping: 18 });
  const autoY = useSpring(0, { stiffness: 40, damping: 18 });
  const scale = useSpring(1, { stiffness: 180, damping: 16 });

  useEffect(() => {
    if (!interactive) {
      const id = window.setInterval(() => {
        autoX.set((Math.random() - 0.5) * 10);
        autoY.set((Math.random() - 0.5) * 10);
      }, 2400 + Math.random() * 1200);
      return () => window.clearInterval(id);
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const cx = cursorX.get();
      const cy = cursorY.get();
      const rect = el.getBoundingClientRect();
      const parent = el.offsetParent as HTMLElement | null;
      if (!parent) return;
      const parentRect = parent.getBoundingClientRect();
      const wx = rect.left - parentRect.left + rect.width / 2;
      const wy = rect.top - parentRect.top + rect.height / 2;
      const dx = wx - cx;
      const dy = wy - cy;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < REPEL_RADIUS) {
        const force = (1 - dist / REPEL_RADIUS) * 28;
        offsetX.set((dx / dist) * force);
        offsetY.set((dy / dist) * force);
      } else {
        offsetX.set(0);
        offsetY.set(0);
      }
    };

    const unsubX = cursorX.on("change", () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    });
    const unsubY = cursorY.on("change", () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    });

    return () => {
      unsubX();
      unsubY();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [autoX, autoY, cursorX, cursorY, interactive, offsetX, offsetY]);

  useEffect(() => {
    scale.set(hovered ? 1.15 : 1);
  }, [hovered, scale]);

  function handleEnter() {
    setHovered(true);
    onHoverChange(word.label);
    setLocalGlitch(true);
    window.setTimeout(() => setLocalGlitch(false), 400);
  }

  function handleLeave() {
    setHovered(false);
    onHoverChange(null);
  }

  const color = hovered
    ? ACCENT
    : dimmed
      ? "rgba(154, 154, 154, 0.28)"
      : "rgba(154, 154, 154, 0.55)";

  return (
    <motion.button
      ref={ref}
      type="button"
      className={`hero-art-word absolute origin-center text-left font-display font-semibold uppercase tracking-[-0.03em] ${
        word.label === "Infofluencer" ? "is-nowrap" : ""
      } ${localGlitch ? "is-glitching" : ""}`}
      style={{
        left: word.x,
        top: word.y,
        fontSize: word.size,
        color,
        rotate: word.rotate,
        x: interactive ? offsetX : autoX,
        y: interactive ? offsetY : autoY,
        scale,
        textShadow: hovered ? "0 0 22px rgba(224, 56, 32, 0.55)" : "none",
        transition: "color 180ms ease, text-shadow 180ms ease",
      }}
      onHoverStart={interactive ? handleEnter : undefined}
      onHoverEnd={interactive ? handleLeave : undefined}
      onFocus={interactive ? handleEnter : undefined}
      onBlur={interactive ? handleLeave : undefined}
      aria-label={word.label}
    >
      <span className="hero-art-word-label block">{word.label}</span>
    </motion.button>
  );
}

export default function HeroArtCanvas({
  className = "",
}: {
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const pulseRef = useRef<Pulse | null>(null);
  const rafRef = useRef(0);
  const lastPulseRef = useRef(0);
  const reducedMotionRef = useRef(false);
  const isMobileRef = useRef(false);

  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqMobile = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      reducedMotionRef.current = mqMotion.matches;
      isMobileRef.current = mqMobile.matches;
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

  const initNodes = useCallback((width: number, height: number) => {
    const count = isMobileRef.current ? MOBILE_NODE_COUNT : NODE_COUNT;
    nodesRef.current = createNodes(count, width, height);
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
      initNodes(width, height);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      const nodes = nodesRef.current;
      const pointer = pointerRef.current;
      const reduced = reducedMotionRef.current;

      if (!reduced) {
        for (const node of nodes) {
          node.vx += (Math.random() - 0.5) * 0.04;
          node.vy += (Math.random() - 0.5) * 0.04;
          node.vx *= 0.98;
          node.vy *= 0.98;

          if (pointer.active) {
            const dx = pointer.x - node.x;
            const dy = pointer.y - node.y;
            const dist = Math.hypot(dx, dy);
            if (dist < ATTRACT_RADIUS && dist > 0.001) {
              const pull = (1 - dist / ATTRACT_RADIUS) * 0.045;
              node.vx += dx * pull;
              node.vy += dy * pull;
            }
          }

          node.x += node.vx;
          node.y += node.vy;
          node.vx += (node.baseX - node.x) * 0.002;
          node.vy += (node.baseY - node.y) * 0.002;

          if (node.x < 0 || node.x > width) node.vx *= -1;
          if (node.y < 0 || node.y > height) node.vy *= -1;
          node.x = Math.max(0, Math.min(width, node.x));
          node.y = Math.max(0, Math.min(height, node.y));
        }
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist > CONNECT_DIST) continue;
          const alpha = 0.15 + (1 - dist / CONNECT_DIST) * 0.2;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(224, 56, 32, ${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      if (pointer.active) {
        for (const node of nodes) {
          const dist = Math.hypot(pointer.x - node.x, pointer.y - node.y);
          if (dist > ATTRACT_RADIUS) continue;
          const alpha = 0.25 + (1 - dist / ATTRACT_RADIUS) * 0.45;
          ctx.beginPath();
          ctx.moveTo(pointer.x, pointer.y);
          ctx.lineTo(node.x, node.y);
          ctx.strokeStyle = `rgba(224, 56, 32, ${alpha})`;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }

        const cursorGlow = ctx.createRadialGradient(
          pointer.x,
          pointer.y,
          0,
          pointer.x,
          pointer.y,
          18,
        );
        cursorGlow.addColorStop(0, "rgba(224, 56, 32, 0.7)");
        cursorGlow.addColorStop(1, "rgba(224, 56, 32, 0)");
        ctx.fillStyle = cursorGlow;
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, 18, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const node of nodes) {
        const glow = ctx.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          8,
        );
        glow.addColorStop(0, "rgba(224, 56, 32, 0.55)");
        glow.addColorStop(1, "rgba(224, 56, 32, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(224, 56, 32, 0.9)";
        ctx.beginPath();
        ctx.arc(node.x, node.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduced) {
        if (!pulseRef.current && time - lastPulseRef.current > PULSE_INTERVAL) {
          const edges: Array<[number, number]> = [];
          for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
              const dist = Math.hypot(
                nodes[i].x - nodes[j].x,
                nodes[i].y - nodes[j].y,
              );
              if (dist < CONNECT_DIST) edges.push([i, j]);
            }
          }
          if (edges.length) {
            const [a, b] = edges[Math.floor(Math.random() * edges.length)];
            pulseRef.current = { a, b, t: 0 };
            lastPulseRef.current = time;
          }
        }

        if (pulseRef.current) {
          const pulse = pulseRef.current;
          pulse.t += 0.025;
          const a = nodes[pulse.a];
          const b = nodes[pulse.b];
          if (a && b) {
            const x = a.x + (b.x - a.x) * pulse.t;
            const y = a.y + (b.y - a.y) * pulse.t;
            const pulseGlow = ctx.createRadialGradient(x, y, 0, x, y, 10);
            pulseGlow.addColorStop(0, "rgba(255, 120, 90, 0.95)");
            pulseGlow.addColorStop(1, "rgba(224, 56, 32, 0)");
            ctx.fillStyle = pulseGlow;
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.fill();
          }
          if (pulse.t >= 1) pulseRef.current = null;
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [initNodes]);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMobile) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      pointerRef.current = { x, y, active: true };
      cursorX.set(x);
      cursorY.set(y);
    },
    [cursorX, cursorY, isMobile],
  );

  const onPointerLeave = useCallback(() => {
    pointerRef.current.active = false;
  }, []);

  const words = useMemo(() => SERVICES, []);

  return (
    <div
      ref={containerRef}
      className={`hero-art-canvas relative aspect-square min-h-[min(70vw,600px)] w-full max-w-[560px] overflow-hidden ${className}`}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      role="img"
      aria-label="593 EMarketing hizmet ağı"
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />

      <div className="absolute inset-0">
        {words.map((word) => (
          <KineticWord
            key={word.label}
            word={word}
            cursorX={cursorX}
            cursorY={cursorY}
            interactive={!isMobile}
            dimmed={hoveredWord !== null && hoveredWord !== word.label}
            onHoverChange={setHoveredWord}
          />
        ))}
      </div>
    </div>
  );
}
