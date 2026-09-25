"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandCoverUpload from "@/components/panel/BrandCoverUpload";
import BrandVisibilityToggle from "@/components/panel/BrandVisibilityToggle";
import { StatusBadge } from "@/components/panel/StatusBadge";
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
}: {
  slug: string;
  name: string;
  visible: boolean;
  coverUrl: string | null;
  health: HealthStatus | null;
  inactive: boolean;
}) {
  const [cover, setCover] = useState(coverUrl);
  useEffect(() => {
    setCover(coverUrl);
  }, [coverUrl]);

  const media = resolveBrandCover({ slug, name, coverUrl: cover });
  const href = `/brands/${encodeURIComponent(slug)}`;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-[1.15rem] border bg-white ${
        inactive ? "border-zinc-200/80" : "border-zinc-200/90"
      }`}
    >
      <Link
        href={href}
        className="group flex flex-col transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e91825]"
      >
        <div className="aspect-square w-full p-2 sm:p-2.5">
          <div
            className={`flex h-full w-full items-center justify-center overflow-hidden rounded-[0.85rem] bg-[#f4f1ea] transition duration-300 group-hover:bg-[#f7f4ed] ${
              inactive ? "opacity-60 grayscale" : ""
            }`}
          >
            {media ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={media.src}
                alt=""
                loading="lazy"
                decoding="async"
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

        <div className="flex flex-col items-center gap-1.5 px-2 pb-2 pt-0.5 text-center sm:px-3">
          <p className="line-clamp-2 text-[11px] font-medium leading-snug tracking-tight text-zinc-800 sm:text-xs">
            {name}
          </p>
          {inactive || !health ? (
            <span className="rounded-md border border-zinc-200 bg-zinc-100 px-2 py-1 text-[10px] font-semibold tracking-wide text-zinc-600">
              Devre dışı
            </span>
          ) : (
            <StatusBadge status={health} />
          )}
        </div>
      </Link>
      <div className="flex flex-col items-center gap-1.5 px-2 pb-3 pt-0.5 sm:px-3 sm:pb-3.5">
        <BrandVisibilityToggle tenantSlug={slug} visible={visible} />
        <BrandCoverUpload
          tenantSlug={slug}
          brandName={name}
          coverUrl={cover}
          variant="card"
          onChanged={setCover}
        />
      </div>
    </div>
  );
}
