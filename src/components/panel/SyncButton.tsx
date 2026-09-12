"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";

export type SyncProvider = "meta" | "google";

type SyncResponse = {
  ok?: boolean;
  error?: string;
  async?: boolean;
  message?: string;
  summary?: {
    provision?: { skipped?: boolean; reason?: string; upserted?: number };
    tenants?: Array<{
      slug: string;
      services: Record<string, { ok: boolean; error?: string }>;
    }>;
  };
};

type SyncStatusResponse = {
  ok?: boolean;
  status?: string;
  error?: string | null;
  jobs?: Array<{
    service: string;
    objective: string;
    status: string;
    error: string | null;
  }>;
};

type SyncResultView = {
  status: "success" | "warn" | "error";
  title: string;
  detail: string;
  lines: string[];
};

function buildResult(
  provider: SyncProvider,
  json: SyncResponse,
  httpOk: boolean,
  tenantSlug?: string,
): SyncResultView {
  const label = provider === "meta" ? "Meta" : "Google";
  const scope = tenantSlug ? `Firma: ${tenantSlug}` : "Tüm markalar";

  if (!httpOk) {
    return {
      status: "error",
      title: `${label} senkronu başarısız`,
      detail: scope,
      lines: [json.error || "Bilinmeyen hata"],
    };
  }

  if (json.async && !json.summary) {
    return {
      status: "success",
      title: `${label} arka planda tamamlandı`,
      detail: scope,
      lines: [json.message || "Senkron bitti — sayfayı yenile."],
    };
  }

  const tenants = json.summary?.tenants ?? [];

  if (provider === "meta") {
    const provision = json.summary?.provision;
    const lines: string[] = [];
    if (provision?.skipped) {
      // Tek marka: provision satırını gösterme (kafa karıştırıyor)
      if (!tenantSlug) {
        lines.push(`Provision atlandı: ${provision.reason || "Meta kurulu değil"}`);
      }
    } else if (provision) {
      lines.push(`Provision: ${provision?.upserted ?? 0} hesap (BM katalog)`);
    }
    for (const t of tenants) {
      const insights = t.services.meta;
      const ads = t.services.metaAds;
      if (insights) {
        lines.push(
          insights.ok
            ? `${t.slug}: kampanya OK`
            : `${t.slug}: kampanya — ${insights.error || "hata"}`,
        );
      }
      if (ads) {
        lines.push(
          ads.ok
            ? `${t.slug}: reklam/thumbnail OK`
            : `${t.slug}: reklam/thumbnail — ${ads.error || "hata"}`,
        );
      }
      const adInsights = t.services.metaAdInsights;
      if (adInsights) {
        lines.push(
          adInsights.ok
            ? `${t.slug}: reklam performansı OK`
            : `${t.slug}: reklam performansı — ${adInsights.error || "hata"}`,
        );
      }
    }
    if (!tenants.length && !provision?.skipped) {
      lines.push("Çekilecek marka bulunamadı");
    }
    const anyFail = tenants.some(
      (t) =>
        (t.services.meta && !t.services.meta.ok) ||
        (t.services.metaAds && !t.services.metaAds.ok) ||
        (t.services.metaAdInsights && !t.services.metaAdInsights.ok),
    );
    if (provision?.skipped && !tenantSlug) {
      return {
        status: "warn",
        title: "Meta atlandı",
        detail: scope,
        lines,
      };
    }
    return {
      status: anyFail ? "warn" : "success",
      title: anyFail ? "Meta kısmen tamamlandı" : "Meta senkronu bitti",
      detail: scope,
      lines: lines.length ? lines : ["İşlem tamam"],
    };
  }

  const lines: string[] = [];
  for (const t of tenants) {
    const parts: string[] = [];
    for (const key of ["ads", "ga4", "gtm", "gsc", "merchant"] as const) {
      const s = t.services[key];
      if (!s) continue;
      parts.push(s.ok ? `${key} ✓` : `${key} ✗`);
    }
    if (parts.length) {
      lines.push(`${t.slug}: ${parts.join(" · ")}`);
    }
    const adsErr =
      t.services.ads && !t.services.ads.ok ? t.services.ads.error : null;
    if (adsErr) lines.push(`  → ${adsErr}`);
  }
  if (!lines.length) lines.push("Çekilecek marka bulunamadı");
  const anyFail = tenants.some((t) =>
    Object.values(t.services).some((s) => s && !s.ok),
  );
  return {
    status: anyFail ? "warn" : "success",
    title: anyFail ? "Google kısmen tamamlandı" : "Google senkronu bitti",
    detail: scope,
    lines,
  };
}

function buildStatusResult(
  provider: SyncProvider,
  tenantSlug: string,
  status: SyncStatusResponse,
): SyncResultView {
  const label = provider === "meta" ? "Meta" : "Google";
  const lines: string[] = [];
  for (const j of status.jobs ?? []) {
    if (j.status === "success") {
      lines.push(`${j.service}: OK`);
    } else if (j.status === "error") {
      lines.push(`${j.service}: ${j.error || "hata"}`);
    } else if (j.status === "running") {
      lines.push(`${j.service}: çalışıyor…`);
    }
  }
  if (status.error) lines.push(status.error);
  if (!lines.length) lines.push("Senkron tamamlandı");

  if (status.status === "error") {
    return {
      status: "error",
      title: `${label} senkronu başarısız`,
      detail: `Firma: ${tenantSlug}`,
      lines,
    };
  }
  const anyJobFail = (status.jobs ?? []).some((j) => j.status === "error");
  return {
    status: anyJobFail ? "warn" : "success",
    title: anyJobFail
      ? `${label} kısmen tamamlandı`
      : `${label} senkronu bitti`,
    detail: `Firma: ${tenantSlug}`,
    lines,
  };
}

async function pollSyncStatus(opts: {
  provider: SyncProvider;
  tenantSlug: string;
  signal?: AbortSignal;
}): Promise<SyncStatusResponse> {
  const deadline = Date.now() + 12 * 60 * 1000; // 12 dk
  while (Date.now() < deadline) {
    if (opts.signal?.aborted) throw new Error("İptal edildi");
    const res = await fetch(
      `/api/panel/sync/status?tenantSlug=${encodeURIComponent(opts.tenantSlug)}&provider=${opts.provider}`,
    );
    const json = (await res.json()) as SyncStatusResponse & { error?: string };
    if (!res.ok) {
      throw new Error(json.error || `Status ${res.status}`);
    }
    if (json.status === "success" || json.status === "error") {
      return json;
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  return {
    status: "error",
    error: "Zaman aşımı — sync hâlâ bitmedi. Birkaç dakika sonra sayfayı yenile.",
    jobs: [],
  };
}

export async function runPanelSync(opts: {
  provider: SyncProvider;
  tenantSlug?: string;
}): Promise<{ httpOk: boolean; json: SyncResponse }> {
  const res = await fetch("/api/panel/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: opts.provider,
      ...(opts.tenantSlug ? { tenantSlug: opts.tenantSlug } : {}),
      siteVerify: false,
    }),
  });
  const text = await res.text();
  try {
    const json = JSON.parse(text) as SyncResponse;
    return { httpOk: res.ok, json };
  } catch {
    const hint = text.trimStart().startsWith("<!")
      ? "Sunucu HTML döndü (proxy/crash/404). Sayfayı yenileyip doğru marka satırından tekrar dene."
      : text.slice(0, 160);
    return {
      httpOk: false,
      json: {
        error: `JSON beklenirken hata (${res.status}): ${hint}`,
      },
    };
  }
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m <= 0) return `${s} sn`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function SyncStatusDialog({
  open,
  phase,
  provider,
  scopeLabel,
  elapsedSec,
  result,
  onClose,
}: {
  open: boolean;
  phase: "running" | "done";
  provider: SyncProvider;
  scopeLabel: string;
  elapsedSec: number;
  result: SyncResultView | null;
  onClose: () => void;
}) {
  const titleId = useId();
  if (!open) return null;

  const providerLabel = provider === "meta" ? "Meta Ads" : "Google (Ads / GA4 / GTM…)";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-900/40 p-4"
      role="presentation"
      onClick={phase === "done" ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-900/10"
        onClick={(e) => e.stopPropagation()}
      >
        {phase === "running" ? (
          <>
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-zinc-200 border-t-[#e91825]"
                aria-hidden
              />
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="text-base font-semibold tracking-tight text-zinc-900"
                >
                  Veri çekiliyor
                </h2>
                <p className="mt-1 text-sm text-zinc-600">{providerLabel}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{scopeLabel}</p>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
              <p className="font-medium">İşlem devam ediyor</p>
              <p className="mt-1 text-xs leading-5 text-amber-900/80">
                Arka planda çalışıyor (proxy 20 sn kesmez). Meta geçmiş +
                kreatifler birkaç dakika sürebilir — bu pencereyi kapatma.
              </p>
              <p className="mt-2 font-mono text-xs tabular-nums text-amber-900">
                Geçen süre: {formatElapsed(elapsedSec)}
              </p>
            </div>
          </>
        ) : result ? (
          <>
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                  result.status === "success"
                    ? "bg-emerald-500"
                    : result.status === "warn"
                      ? "bg-amber-500"
                      : "bg-rose-500"
                }`}
                aria-hidden
              >
                {result.status === "success"
                  ? "✓"
                  : result.status === "warn"
                    ? "!"
                    : "×"}
              </span>
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="text-base font-semibold tracking-tight text-zinc-900"
                >
                  {result.title}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">{result.detail}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Süre: {formatElapsed(elapsedSec)}
                </p>
              </div>
            </div>

            <ul className="mt-4 max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-xs leading-5 text-zinc-700">
              {result.lines.map((line, i) => (
                <li key={`${i}-${line.slice(0, 24)}`} className="break-words">
                  {line}
                </li>
              ))}
            </ul>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-[#e91825] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#c91420]"
              >
                Tamam
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [phase, setPhase] = useState<"running" | "done">("running");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [result, setResult] = useState<SyncResultView | null>(null);

  const defaultLabel =
    provider === "meta"
      ? tenantSlug
        ? "Meta çek"
        : "Meta · tümü"
      : tenantSlug
        ? "Google çek"
        : "Google · tümü";

  const scopeLabel = tenantSlug
    ? `Firma: ${tenantSlug}`
    : "Kapsam: tüm görünür markalar";

  useEffect(() => {
    if (!pending) return;
    setElapsedSec(0);
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [pending]);

  async function onClick() {
    if (pending) return;
    setPending(true);
    setDialogOpen(true);
    setPhase("running");
    setResult(null);
    try {
      const { httpOk, json } = await runPanelSync({ provider, tenantSlug });
      if (!httpOk) {
        setResult(buildResult(provider, json, false, tenantSlug));
        setPhase("done");
        return;
      }
      // Arka plan sync — poll sentinel job (tek marka)
      if (json.async && tenantSlug) {
        const status = await pollSyncStatus({ provider, tenantSlug });
        setResult(buildStatusResult(provider, tenantSlug, status));
        setPhase("done");
        router.refresh();
        return;
      }
      if (json.async && !tenantSlug) {
        setResult({
          status: "success",
          title: `${provider === "meta" ? "Meta" : "Google"} arka planda başladı`,
          detail: scopeLabel,
          lines: [
            json.message || "Tüm markalar için sync başladı.",
            "Birkaç dakika sonra sayfayı yenile.",
          ],
        });
        setPhase("done");
        return;
      }
      setResult(buildResult(provider, json, true, tenantSlug));
      setPhase("done");
      router.refresh();
    } catch (err) {
      setResult({
        status: "error",
        title: "Bağlantı hatası",
        detail: scopeLabel,
        lines: [err instanceof Error ? err.message : "Network error"],
      });
      setPhase("done");
    } finally {
      setPending(false);
    }
  }

  function onClose() {
    if (pending) return;
    setDialogOpen(false);
    setResult(null);
  }

  return (
    <>
      <div className="flex flex-col items-stretch gap-1">
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
      </div>

      <SyncStatusDialog
        open={dialogOpen}
        phase={phase}
        provider={provider}
        scopeLabel={scopeLabel}
        elapsedSec={elapsedSec}
        result={result}
        onClose={onClose}
      />
    </>
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
