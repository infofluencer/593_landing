"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Faz 2 — yalnızca API veri senkronu.
 * Site testi (Playwright) ayrı: GTM sayfasındaki buton / SITE_VERIFY_ON_SYNC.
 */
export default function SyncButton({ tenantSlug }: { tenantSlug?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/panel/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(tenantSlug ? { tenantSlug } : {}),
          siteVerify: false,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        summary?: {
          provision?: { skipped?: boolean; reason?: string; upserted?: number };
        };
      };
      if (!res.ok) {
        setMessage(json.error || "Sync başarısız");
      } else if (json.summary?.provision?.skipped) {
        setMessage(
          `Sync bitti (Meta atlandı: ${json.summary.provision.reason})`,
        );
      } else {
        setMessage(
          `Sync tamam · ${json.summary?.provision?.upserted ?? 0} Meta hesap`,
        );
      }
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
      >
        {pending ? "Senkronize…" : "Veriyi yenile"}
      </button>
      {message ? (
        <p className="max-w-xs text-right text-[11px] text-zinc-500">{message}</p>
      ) : null}
    </div>
  );
}
