"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type SyncProvider = "meta" | "google";

type SyncResponse = {
  ok?: boolean;
  error?: string;
  summary?: {
    provision?: { skipped?: boolean; reason?: string; upserted?: number };
    tenants?: Array<{
      slug: string;
      services: Record<string, { ok: boolean; error?: string }>;
    }>;
  };
};

function summarize(
  provider: SyncProvider,
  json: SyncResponse,
  scope: "bulk" | "tenant",
): string {
  if (provider === "meta") {
    if (json.summary?.provision?.skipped) {
      return `Meta atlandı: ${json.summary.provision.reason || "kurulu değil"}`;
    }
    const n = json.summary?.provision?.upserted ?? 0;
    const tenants = json.summary?.tenants ?? [];
    const ok = tenants.filter((t) => t.services.meta?.ok).length;
    const fail = tenants.filter((t) => t.services.meta && !t.services.meta.ok);
    if (scope === "tenant") {
      const err = fail[0]?.services.meta?.error;
      return err ? `Meta hata: ${err}` : "Meta tamam";
    }
    if (fail.length) {
      return `Meta · ${ok}/${tenants.length} OK · provision ${n}`;
    }
    return `Meta tamam · ${tenants.length} marka · provision ${n}`;
  }

  const tenants = json.summary?.tenants ?? [];
  const adsOk = tenants.filter((t) => t.services.ads?.ok).length;
  const adsFail = tenants.filter((t) => t.services.ads && !t.services.ads.ok);
  if (scope === "tenant") {
    const err = adsFail[0]?.services.ads?.error;
    return err ? `Google hata: ${err}` : "Google tamam";
  }
  if (adsFail.length) {
    return `Google · Ads ${adsOk}/${tenants.length} OK`;
  }
  return `Google tamam · ${tenants.length} marka`;
}

export async function runPanelSync(opts: {
  provider: SyncProvider;
  tenantSlug?: string;
}): Promise<{ ok: boolean; message: string }> {
  const res = await fetch("/api/panel/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: opts.provider,
      ...(opts.tenantSlug ? { tenantSlug: opts.tenantSlug } : {}),
      siteVerify: false,
    }),
  });
  const json = (await res.json()) as SyncResponse;
  if (!res.ok) {
    return { ok: false, message: json.error || "Sync başarısız" };
  }
  return {
    ok: true,
    message: summarize(
      opts.provider,
      json,
      opts.tenantSlug ? "tenant" : "bulk",
    ),
  };
}

export default function SyncButton({
  provider,
  tenantSlug,
  label,
  compact,
}: {
  provider: SyncProvider;
  tenantSlug?: string;
  label?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const defaultLabel =
    provider === "meta"
      ? tenantSlug
        ? "Meta çek"
        : "Meta · tümü"
      : tenantSlug
        ? "Google çek"
        : "Google · tümü";

  async function onClick() {
    setPending(true);
    setMessage(null);
    try {
      const result = await runPanelSync({ provider, tenantSlug });
      setMessage(result.message);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`flex flex-col ${compact ? "items-stretch" : "items-end"} gap-1`}>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={
          compact
            ? "rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
            : "rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
        }
      >
        {pending ? "Çekiliyor…" : label ?? defaultLabel}
      </button>
      {message && !compact ? (
        <p className="max-w-xs text-right text-[11px] text-zinc-500">{message}</p>
      ) : null}
      {message && compact ? (
        <p className="max-w-[10rem] text-[10px] leading-snug text-zinc-500">
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Ajans Markalar — toplu Meta / Google. */
export function BulkSyncToolbar() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <SyncButton provider="meta" />
      <SyncButton provider="google" />
    </div>
  );
}

/** Tek satır — firma özel Meta / Google. */
export function TenantSyncActions({ tenantSlug }: { tenantSlug: string }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <SyncButton provider="meta" tenantSlug={tenantSlug} compact />
      <SyncButton provider="google" tenantSlug={tenantSlug} compact />
    </div>
  );
}
