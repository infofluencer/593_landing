"use client";

import Link from "next/link";
import SyncButton from "@/components/panel/SyncButton";

export default function BrandDetailHeaderActions({
  tenantSlug,
  metaLastSynced,
  googleLastSynced,
  active = true,
}: {
  tenantSlug: string;
  metaLastSynced: string;
  googleLastSynced: string;
  active?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-end gap-2.5 sm:gap-3">
      {active ? (
        <>
          <SyncButton
            provider="meta"
            tenantSlug={tenantSlug}
            appearance="meta"
            caption={metaLastSynced}
          />
          <SyncButton
            provider="google"
            tenantSlug={tenantSlug}
            appearance="google"
            caption={googleLastSynced}
          />
        </>
      ) : (
        <p className="max-w-[14rem] text-right text-[11px] leading-snug text-zinc-500">
          Devre dışı — veri çekilmez.
        </p>
      )}
      <div className="flex flex-col items-stretch gap-1">
        <p className="text-center text-[10px] leading-tight text-transparent select-none">
          .
        </p>
        <Link
          href="#ayarlar"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#e91825] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d01420]"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            aria-hidden
          >
            <circle
              cx="12"
              cy="12"
              r="3"
              stroke="currentColor"
              strokeWidth="1.75"
            />
            <path
              d="M12 3.5v2M12 18.5v2M4.9 6.5l1.6 1.4M17.5 16.1l1.6 1.4M3.5 12h2M18.5 12h2M4.9 17.5l1.6-1.4M17.5 7.9l1.6-1.4"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
          Ayarlar
        </Link>
      </div>
    </div>
  );
}
