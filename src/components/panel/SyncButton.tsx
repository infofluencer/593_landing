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
  const scope = tenantSlug ? `Firma: ${tenantSlug}` : "Tüm aktif markalar";

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
  const labelFor = (service: string, objective: string) => {
    if (service === "ads" && objective === "creatives") return "reklam/thumbnail";
    if (service === "insights") return "kampanya";
    if (service === "ad_insights") return "reklam performansı";
    return `${service}/${objective}`;
  };
  for (const j of status.jobs ?? []) {
    const name = labelFor(j.service, j.objective);
    if (j.status === "success") {
      lines.push(`${name}: OK`);
    } else if (j.status === "error") {
      lines.push(`${name}: ${j.error || "hata"}`);
    } else if (j.status === "running") {
      lines.push(`${name}: çalışıyor…`);
    }
  }
  if (status.error && status.status === "error") lines.push(status.error);
  if (!lines.length) lines.push("Senkron tamamlandı");

  if (status.status === "error") {
    return {
      status: "error",
      title: `${label} senkronu başarısız`,
      detail: `Firma: ${tenantSlug}`,
      lines,
    };
  }
  // panel_sync success → overall success; only warn if a current job failed
  const anyJobFail = (status.jobs ?? []).some((j) => j.status === "error");
  if (status.status === "success" && !anyJobFail) {
    return {
      status: "success",
      title: `${label} senkronu bitti`,
      detail: `Firma: ${tenantSlug}`,
      lines,
    };
  }
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
  appearance = "plain",
  caption,
}: {
  provider: SyncProvider;
  tenantSlug?: string;
  label?: string;
  compact?: boolean;
  /** plain = mevcut stil; meta/google = detay header kutuları */
  appearance?: "plain" | "meta" | "google";
  /** Butonun üstünde gösterilen satır (örn. son çekim zamanı) */
  caption?: string;
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

  const branded = appearance === "meta" || appearance === "google";
  const buttonClass = branded
    ? appearance === "meta"
      ? "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#166fe5] disabled:opacity-60"
      : "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
    : compact
      ? "rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
      : "rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50";

  return (
    <>
      <div className="flex flex-col items-stretch gap-1">
        {caption ? (
          <p className="text-center text-[10px] tabular-nums leading-tight text-zinc-500">
            {caption}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onClick}
          disabled={pending}
          className={buttonClass}
        >
          {appearance === "meta" ? <MetaLogo className="size-4 shrink-0" /> : null}
          {appearance === "google" ? (
            <GoogleLogo className="size-4 shrink-0" />
          ) : null}
          {pending
            ? "Çekiliyor…"
            : branded
              ? provider === "meta"
                ? "Meta verilerini güncelle"
                : "Google verilerini güncelle"
              : (label ?? defaultLabel)}
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

function MetaLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z" />
    </svg>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/** Ajans Markalar — toplu Meta / Google (marka detay ile aynı markalı butonlar). */
export function BulkSyncToolbar() {
  return (
    <div className="flex flex-wrap items-end justify-end gap-2.5 sm:gap-3">
      <SyncButton
        provider="meta"
        appearance="meta"
        caption="Tüm aktif markalar"
      />
      <SyncButton
        provider="google"
        appearance="google"
        caption="Tüm aktif markalar"
      />
    </div>
  );
}

/** Tek satır — firma özel Meta / Google. */
export function TenantSyncActions({
  tenantSlug,
  align = "end",
}: {
  tenantSlug: string;
  align?: "start" | "end";
}) {
  return (
    <div
      className={[
        "flex flex-wrap items-center gap-1.5",
        align === "start" ? "justify-start" : "justify-end",
      ].join(" ")}
    >
      <SyncButton provider="meta" tenantSlug={tenantSlug} compact />
      <SyncButton provider="google" tenantSlug={tenantSlug} compact />
    </div>
  );
}
