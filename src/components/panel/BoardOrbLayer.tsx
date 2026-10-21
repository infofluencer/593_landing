"use client";

import { useRef, useState } from "react";
import LogoOrb from "@/components/LogoOrb";

const STORAGE_KEY = "board-orb-pos";
/** Bu kadar basılı tutunca sürükleme başlar (ms). */
const HOLD_MS = 80;
/** Bekleme bitmeden bu kadar kayarsa sürükleme iptal (px). */
const HOLD_SLOP = 6;

/** Merkez, katmanın genişlik/yüksekliğine oranla (0–1); boyut değişse de yerinde kalır. */
type Pos = { x: number; y: number };

function readPos(): Pos | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pos;
    return Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
  } catch {
    return null;
  }
}

function writePos(p: Pos) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Gizli pencere vb. — konum yalnızca bu oturumda kalır.
  }
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Basılı tutup sürüklenebilen logo. Yalnızca istemcide render edilir
 * (BoardBackdrop `ssr: false` ile yükler), bu yüzden ilk konum doğrudan
 * localStorage’dan okunabilir.
 */
export default function BoardOrbLayer() {
  const layerRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(readPos);
  const [dragging, setDragging] = useState(false);
  const press = useRef<{
    id: number;
    startX: number;
    startY: number;
    /** İşaretçi ile logo merkezi arasındaki fark (px). */
    dx: number;
    dy: number;
    timer: number;
    active: boolean;
  } | null>(null);

  function toPos(clientX: number, clientY: number, dx: number, dy: number): Pos {
    const r = layerRef.current!.getBoundingClientRect();
    return {
      x: clamp((clientX - dx - r.left) / r.width),
      y: clamp((clientY - dy - r.top) / r.height),
    };
  }

  function end() {
    const p = press.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    press.current = null;
    if (p.active) {
      setDragging(false);
      setPos((cur) => {
        if (cur) writePos(cur);
        return cur;
      });
    }
  }

  return (
    <div ref={layerRef} className="absolute inset-0">
      <div
        ref={orbRef}
        className={`pointer-events-auto absolute size-[min(80vw,40rem)] touch-none select-none transition-transform duration-200 ${
          pos ? "" : "-bottom-24 -right-20"
        } ${dragging ? "scale-[1.04] cursor-grabbing" : "cursor-grab"}`}
        style={
          pos
            ? {
                left: `${pos.x * 100}%`,
                top: `${pos.y * 100}%`,
                translate: "-50% -50%",
              }
            : undefined
        }
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const rect = orbRef.current!.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const id = e.pointerId;
          const target = e.currentTarget;
          press.current = {
            id,
            startX: e.clientX,
            startY: e.clientY,
            dx: e.clientX - cx,
            dy: e.clientY - cy,
            active: false,
            timer: window.setTimeout(() => {
              const p = press.current;
              if (!p || p.id !== id) return;
              p.active = true;
              setDragging(true);
              try {
                target.setPointerCapture(id);
              } catch {
                // İşaretçi çoktan bırakıldıysa yakalanamaz.
              }
            }, HOLD_MS),
          };
        }}
        onPointerMove={(e) => {
          const p = press.current;
          if (!p || p.id !== e.pointerId) return;
          if (!p.active) {
            // Basılı tutmadan kaydırdı: sürükleme değil.
            if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > HOLD_SLOP) {
              end();
            }
            return;
          }
          setPos(toPos(e.clientX, e.clientY, p.dx, p.dy));
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onDoubleClick={() => {
          // Çift tık: varsayılan köşeye dön.
          setPos(null);
          try {
            window.localStorage.removeItem(STORAGE_KEY);
          } catch {
            // yoksay
          }
        }}
        title="Basılı tutup sürükleyin · çift tık: yerine döndür"
      >
        <LogoOrb />
      </div>
    </div>
  );
}
