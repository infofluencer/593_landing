import { prisma } from "@/lib/db";
import { hasBrandLogo } from "@/lib/panel/brand-logos";
import { runAgencySync, type SyncSummary } from "@/lib/panel/sync";
import { upsertSyncJob } from "@/lib/panel/sync-job";

const LOCK_SERVICE = "cron";
const LOCK_OBJECTIVE = "daily_sync";
const SLOT_MS = 3 * 60 * 60 * 1000;
const STALE_RUNNING_MS = 25 * 60 * 1000;

export async function listLogoTenants() {
  const tenants = await prisma.tenant.findMany({
    where: { visible: true },
    select: { id: true, slug: true, name: true, coverUrl: true },
  });
  return tenants
    .filter((t) =>
      hasBrandLogo({ slug: t.slug, name: t.name, coverUrl: t.coverUrl }),
    )
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export type DailySyncResult = {
  skipped?: boolean;
  reason?: string;
  slugs?: string[];
  summary?: SyncSummary;
};

/**
 * Logolu görünür markalar — son 3 gün Meta + Google kampanya metrikleri.
 * Tam 720g / kreatif / fatura / GA4 çekilmez.
 */
export async function runScheduledDailySync(): Promise<DailySyncResult> {
  const tenants = await listLogoTenants();
  if (tenants.length === 0) {
    return { skipped: true, reason: "Logolu görünür marka yok." };
  }

  const lockTenantId = tenants[0].id;
  const now = Date.now();

  const lock = await prisma.syncJob.findUnique({
    where: {
      tenantId_provider_service_objective: {
        tenantId: lockTenantId,
        provider: "meta",
        service: LOCK_SERVICE,
        objective: LOCK_OBJECTIVE,
      },
    },
  });

  if (
    lock?.status === "running" &&
    lock.updatedAt.getTime() > now - STALE_RUNNING_MS
  ) {
    return { skipped: true, reason: "Günlük sync zaten çalışıyor." };
  }
  if (lock?.lastSuccessAt && lock.lastSuccessAt.getTime() > now - SLOT_MS) {
    return { skipped: true, reason: "Bu slot zaten çekildi." };
  }

  await upsertSyncJob({
    tenantId: lockTenantId,
    provider: "meta",
    service: LOCK_SERVICE,
    objective: LOCK_OBJECTIVE,
    status: "running",
    error: null,
  });

  for (const t of tenants) {
    for (const provider of ["meta", "google"] as const) {
      await upsertSyncJob({
        tenantId: t.id,
        provider,
        service: "panel_sync",
        objective: "run",
        status: "running",
        error: null,
      });
    }
  }

  try {
    const summary = await runAgencySync({
      mode: "daily",
      logoOnly: true,
      providers: ["meta", "google"],
    });

    for (const t of tenants) {
      for (const provider of ["meta", "google"] as const) {
        const tenantSummary = summary.tenants.find((x) => x.slug === t.slug);
        const failed = tenantSummary
          ? Object.values(tenantSummary.services).some((s) => s && !s.ok)
          : false;
        const firstErr = tenantSummary
          ? Object.values(tenantSummary.services).find((s) => s && !s.ok)
              ?.error
          : null;
        await upsertSyncJob({
          tenantId: t.id,
          provider,
          service: "panel_sync",
          objective: "run",
          status: failed ? "error" : "success",
          error: failed ? firstErr || "kısmi hata" : null,
          markSuccess: !failed,
        });
      }
    }

    await upsertSyncJob({
      tenantId: lockTenantId,
      provider: "meta",
      service: LOCK_SERVICE,
      objective: LOCK_OBJECTIVE,
      status: "success",
      error: null,
      markSuccess: true,
    });

    return { slugs: tenants.map((t) => t.slug), summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[daily sync]", message);
    for (const t of tenants) {
      for (const provider of ["meta", "google"] as const) {
        await upsertSyncJob({
          tenantId: t.id,
          provider,
          service: "panel_sync",
          objective: "run",
          status: "error",
          error: message,
        });
      }
    }
    await upsertSyncJob({
      tenantId: lockTenantId,
      provider: "meta",
      service: LOCK_SERVICE,
      objective: LOCK_OBJECTIVE,
      status: "error",
      error: message,
    });
    throw err;
  }
}
