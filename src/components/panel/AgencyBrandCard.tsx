"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import BrandCoverUpload from "@/components/panel/BrandCoverUpload";
import BrandVisibilityToggle from "@/components/panel/BrandVisibilityToggle";
import {
  brandInitials,
  resolveBrandCover,
} from "@/lib/panel/brand-logos";
import type { HealthStatus } from "@/lib/panel/mock-data";

export default function AgencyBrandCard({
  slug,
  name,
  visible,
  coverUrl,
  health,
  inactive,
  grabbing = false,
  settled = true,
}: {
  slug: string;
  name: string;
  visible: boolean;
  coverUrl: string | null;
  health: HealthStatus | null;
  inactive: boolean;
  grabbing?: boolean;
  settled?: boolean;
}) {
  const [cover, setCover] = useState(coverUrl);
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCover(coverUrl);
  }, [coverUrl]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  const media = resolveBrandCover({ slug, name, coverUrl: cover });
  const showMedia = media && media.src !== brokenSrc;
  const href = `/brands/${encodeURIComponent(slug)}`;
  // Liste sakin kalsın: rozet yok, yalnızca bakılması gereken markada küçük nokta.
  const needsLook = !inactive && (health === "critical" || health === "warn");

  return (
    <div
      className={`group/card relative flex flex-col overflow-hidden rounded-[1.15rem] border bg-white transition ${
        grabbing ? "cursor-grab active:cursor-grabbing" : "hover:border-zinc-300 hover:shadow-sm"
      } ${inactive ? "border-zinc-200/80" : "border-zinc-200/90"}`}
    >
      <Link
        href={href}
        className={`group flex flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e91825] ${
          settled ? "" : "pointer-events-none"
        }`}
      >
        <div className="aspect-square w-full p-2 sm:p-2.5">
          <div
            className={`flex h-full w-full items-center justify-center overflow-hidden rounded-[0.85rem] bg-[#f4f1ea] transition duration-300 group-hover:bg-[#f7f4ed] ${
              inactive ? "opacity-60 grayscale" : ""
            }`}
          >
            {showMedia ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={media.src}
                alt=""
                loading="lazy"
                decoding="async"
                onError={() => setBrokenSrc(media.src)}
                className={
                  media.fit === "cover"
                    ? "h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    : "h-full w-full object-contain p-2.5 transition duration-300 group-hover:scale-[1.03] sm:p-3"
                }
              />
            ) : (
              <span className="select-none text-2xl font-semibold tracking-tight text-zinc-400 sm:text-3xl">
                {brandInitials(name)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-start justify-center gap-1.5 px-3 pb-3.5 pt-0.5 text-center">
          {needsLook ? (
            <span
              className="mt-[0.3rem] size-1.5 shrink-0 rounded-full bg-amber-400"
              title="Kontrol edilecek bir konu var — detayda açıklaması var"
              aria-label="Kontrol edilecek konu var"
            />
          ) : null}
          <p className="line-clamp-2 text-[11px] font-medium leading-snug tracking-tight text-zinc-800 sm:text-xs">
            {name}
          </p>
        </div>
        {inactive ? (
          <p className="-mt-2 pb-3 text-center text-[10px] text-zinc-400">Devre dışı</p>
        ) : null}
      </Link>

      {grabbing ? null : (
        <div
          ref={menuRef}
          className="absolute right-3.5 top-3.5 sm:right-4 sm:top-4"
          data-no-dnd
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            aria-label={`${name} seçenekleri`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex size-7 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-zinc-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-zinc-900 focus-visible:opacity-100 ${
              menuOpen ? "opacity-100" : "opacity-0 group-hover/card:opacity-100 [@media(hover:none)]:opacity-100"
            }`}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
          {/* Hep mounted: dosya seçici menü kapanınca kaybolmasın. */}
          <div
            role="menu"
            className={`absolute right-0 top-8 z-20 w-40 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg ${
              menuOpen ? "" : "hidden"
            }`}
          >
            <BrandCoverUpload
              tenantSlug={slug}
              brandName={name}
              coverUrl={cover}
              variant="menu"
              onChanged={(next) => {
                setCover(next);
                setBrokenSrc(null);
                setMenuOpen(false);
              }}
            />
            <BrandVisibilityToggle tenantSlug={slug} visible={visible} variant="menu" />
          </div>
        </div>
      )}
    </div>
  );
}
