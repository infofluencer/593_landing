import { prisma } from "@/lib/db";
import { runAgencySync, type SyncSummary } from "@/lib/panel/sync";
import { upsertSyncJob } from "@/lib/panel/sync-job";

/**
 * Dönüşüm kuralları değişince sürümü artır → tüm aktif markalar yeniden doldurulur.
 * v2: Meta lead tekilleştirme, Google aksiyon filtresi, günlük Conversion + GA4.
 */
export const BACKFILL_SERVICE = "backfill";
export const BACKFILL_VERSION = "conversions_v2";

/** Bir markada bu süreden eski "running" kaydı yarıda kalmış sayılır. */
const STALE_RUNNING_MS = 30 * 60 * 1000;

export type BackfillTenantResult = {
  slug: string;
  status: "success" | "partial" | "error" | "skipped";
  detail?: string;
};

function serviceErrors(summary: SyncSummary, slug: string): string[] {
  const t = summary.tenants.find((x) => x.slug === slug);
  if (!t) return [];
  return Object.entries(t.services)
    .filter(([, s]) => s && !s.ok)
    .map(([k, s]) => `${k}: ${s.error || "hata"}`);
}

/** Aktif (görünür) markalar + backfill durumları. */
export async function listBackfillStatus() {
  const tenants = await prisma.tenant.findMany({
    where: { visible: true },
    select: {
      id: true,
      slug: true,
      name: true,
      syncJobs: {
        where: { service: BACKFILL_SERVICE, objective: BACKFILL_VERSION },
        select: {
          status: true,
          error: true,
          lastSuccessAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return tenants.map((t) => {
    const job = t.syncJobs[0] ?? null;
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      status: job?.status ?? null,
      error: job?.error ?? null,
      lastSuccessAt: job?.lastSuccessAt?.toISOString() ?? null,
      updatedAt: job?.updatedAt.toISOString() ?? null,
    };
  });
}

export async function isBackfillRunning(): Promise<boolean> {
  const running = await prisma.syncJob.findFirst({
    where: {
      service: BACKFILL_SERVICE,
      objective: BACKFILL_VERSION,
      status: "running",
      updatedAt: { gt: new Date(Date.now() - STALE_RUNNING_MS) },
    },
    select: { id: true },
  });
  return Boolean(running);
}

/**
 * Geriye dönük doldurma: aktif markaları SIRAYLA 720 gün yeniden çeker
 * (Meta kampanya, Google Ads kampanya + dönüşüm aksiyonu, GA4 günlük).
 * Bu sürümde başarıyla doldurulan markalar atlanır (force hariç) — yarıda
 * kalırsa tekrar çalıştırmak kaldığı yerden devam eder.
 */
export async function runConversionBackfill(opts?: {
  slugs?: string[];
  force?: boolean;
  onProgress?: (r: BackfillTenantResult, index: number, total: number) => void;
}): Promise<BackfillTenantResult[]> {
  const status = await listBackfillStatus();
  const targets = opts?.slugs?.length
    ? status.filter((t) => opts.slugs!.includes(t.slug))
    : status;

  const results: BackfillTenantResult[] = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]!;
    const report = (r: BackfillTenantResult) => {
      results.push(r);
      opts?.onProgress?.(r, i + 1, targets.length);
    };

    if (!opts?.force && t.status === "success") {
      report({ slug: t.slug, status: "skipped", detail: "zaten dolduruldu" });
      continue;
    }

    await upsertSyncJob({
      tenantId: t.id,
      provider: "google",
      service: BACKFILL_SERVICE,
      objective: BACKFILL_VERSION,
      status: "running",
      error: null,
    });

    try {
      const summary = await runAgencySync({
        tenantSlug: t.slug,
        mode: "backfill",
        providers: ["meta", "google"],
      });
      const errors = serviceErrors(summary, t.slug);
      // Eksik eşleştirme (ör. GA4 yok) markayı "başarısız" yapmaz; ayrıntı saklanır.
      await upsertSyncJob({
        tenantId: t.id,
        provider: "google",
        service: BACKFILL_SERVICE,
        objective: BACKFILL_VERSION,
        status: "success",
        error: errors.length ? errors.join(" · ").slice(0, 1000) : null,
        markSuccess: true,
      });
      report({
        slug: t.slug,
        status: errors.length ? "partial" : "success",
        detail: errors.join(" · ") || undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await upsertSyncJob({
        tenantId: t.id,
        provider: "google",
        service: BACKFILL_SERVICE,
        objective: BACKFILL_VERSION,
        status: "error",
        error: message.slice(0, 1000),
      });
      report({ slug: t.slug, status: "error", detail: message });
    }
  }
  return results;
}
