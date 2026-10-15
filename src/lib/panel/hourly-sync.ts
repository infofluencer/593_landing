import type { Provider } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDaysYmd, ymdInTimeZone, ymdToUtcDate } from "@/lib/date/tr";
import {
  fetchGoogleAccountHealth,
  fetchGoogleHourlySpend,
} from "@/lib/integrations/google/hourly";
import {
  fetchMetaAccountHealth,
  fetchMetaHourlySpend,
  type AccountHealthResult,
  type HourlyRow,
} from "@/lib/integrations/meta/hourly";
import { resolveAlert, upsertOpenAlert } from "@/lib/panel/alerts-engine";
import { resolveAdsCustomerId } from "@/lib/panel/google-ads-customer-map";
import { resolveMetaAccountId } from "@/lib/panel/meta-ad-account-map";
import { runSynced } from "@/lib/panel/sync-job";

/** Saatlik satırlar bu kadar gün tutulur (grafik yalnızca bugünü kullanır). */
const HOURLY_RETENTION_DAYS = 14;

export type HourlySyncSummary = {
  tenants: number;
  ok: number;
  failed: Array<{ slug: string; step: string; error: string }>;
};

async function saveHourly(opts: {
  tenantId: string;
  provider: Provider;
  date: string;
  rows: HourlyRow[];
}) {
  const date = ymdToUtcDate(opts.date);
  // Gün baştan yazılır — Meta geç gelen saatleri sonradan düzeltebiliyor.
  await prisma.$transaction([
    prisma.hourlySpend.deleteMany({
      where: { tenantId: opts.tenantId, provider: opts.provider, date },
    }),
    prisma.hourlySpend.createMany({
      data: opts.rows.map((r) => ({
        tenantId: opts.tenantId,
        provider: opts.provider,
        date,
        hour: r.hour,
        spend: r.spend,
        impressions: r.impressions,
        clicks: r.clicks,
      })),
    }),
  ]);
}

/**
 * Saatlik çekimin "bugün"ü — Meta marka saat diliminde, Google Ads hesap
 * saat diliminde. Tablo da aynı tarihle okur; İstanbul'dan farklıysa saatlik
 * veri İstanbul bugününe yazılmaz.
 */
export function hourlyDateFor(
  tenant: { timezone: string; mapping?: { adsTimezone?: string | null } | null },
  provider: Provider,
): string {
  return ymdInTimeZone(
    provider === "google" ? (tenant.mapping?.adsTimezone ?? tenant.timezone) : tenant.timezone,
  );
}

const PROVIDER_LABEL: Record<Provider, string> = { meta: "Meta", google: "Google Ads" };

/** Son durumu yazar; ödeme sorunu alarm açar, düzelince kapatır. */
async function saveAccountHealth(opts: {
  tenantId: string;
  provider: Provider;
  result: AccountHealthResult;
}) {
  const { tenantId, provider, result } = opts;
  const prev = await prisma.accountHealth.findUnique({
    where: { tenantId_provider: { tenantId, provider } },
  });
  const changed = !prev || prev.status !== result.status || prev.label !== result.label;
  const now = new Date();
  await prisma.accountHealth.upsert({
    where: { tenantId_provider: { tenantId, provider } },
    update: {
      status: result.status,
      label: result.label,
      detail: result.detail,
      raw: JSON.parse(JSON.stringify(result.raw)),
      checkedAt: now,
      ...(changed ? { changedAt: now } : {}),
    },
    create: {
      tenantId,
      provider,
      status: result.status,
      label: result.label,
      detail: result.detail,
      raw: JSON.parse(JSON.stringify(result.raw)),
      checkedAt: now,
      changedAt: now,
    },
  });

  const alertType = `payment_${provider}`;
  if (result.status === "critical" || result.status === "warn") {
    await upsertOpenAlert({
      tenantId,
      type: alertType,
      severity: result.status,
      message: `${PROVIDER_LABEL[provider]}: ${result.label}${result.detail ? ` — ${result.detail}` : ""}`,
    });
  } else if (result.status === "ok") {
    const open = await prisma.alert.findMany({
      where: { tenantId, type: alertType, resolved: false },
      select: { id: true },
    });
    for (const a of open) {
      await resolveAlert({ alertId: a.id, by: "system", note: "Hesap durumu düzeldi" });
    }
  }
}

/**
 * Bugünün saatlik harcaması + hesap/ödeme durumu, görünür tüm markalar.
 * Hata bir markayı/adımı durdurur, diğerlerini değil (runSynced kaydeder).
 */
export async function runHourlySync(opts?: {
  tenantSlug?: string;
}): Promise<HourlySyncSummary> {
  const tenants = await prisma.tenant.findMany({
    where: { visible: true, ...(opts?.tenantSlug ? { slug: opts.tenantSlug } : {}) },
    include: { mapping: true },
    orderBy: { sortOrder: "asc" },
  });

  const summary: HourlySyncSummary = { tenants: tenants.length, ok: 0, failed: [] };
  const record = (slug: string, step: string, r: { ok: boolean; error?: string }) => {
    if (r.ok) summary.ok += 1;
    else summary.failed.push({ slug, step, error: r.error ?? "bilinmeyen" });
  };

  for (const t of tenants) {
    const off = new Set(t.disabledIntegrations);
    const metaAccountId = off.has("meta") ? null : resolveMetaAccountId(t);
    if (metaAccountId) {
      const date = hourlyDateFor(t, "meta");
      record(
        t.slug,
        "meta_hourly",
        await runSynced(
          { tenantId: t.id, provider: "meta", service: "hourly", objective: "today" },
          async () => {
            const rows = await fetchMetaHourlySpend({ metaAccountId, date });
            await saveHourly({ tenantId: t.id, provider: "meta", date, rows });
          },
        ),
      );
      record(
        t.slug,
        "meta_account",
        await runSynced(
          { tenantId: t.id, provider: "meta", service: "account_status", objective: "default" },
          async () => {
            const result = await fetchMetaAccountHealth(metaAccountId);
            await saveAccountHealth({ tenantId: t.id, provider: "meta", result });
          },
        ),
      );
    }

    const customerId = off.has("google_ads") ? null : resolveAdsCustomerId(t);
    if (customerId) {
      const date = hourlyDateFor(t, "google");
      record(
        t.slug,
        "google_hourly",
        await runSynced(
          { tenantId: t.id, provider: "google", service: "hourly", objective: "today" },
          async () => {
            const rows = await fetchGoogleHourlySpend({ customerId, date });
            await saveHourly({ tenantId: t.id, provider: "google", date, rows });
          },
        ),
      );
      record(
        t.slug,
        "google_account",
        await runSynced(
          { tenantId: t.id, provider: "google", service: "account_status", objective: "default" },
          async () => {
            const result = await fetchGoogleAccountHealth(customerId);
            await saveAccountHealth({ tenantId: t.id, provider: "google", result });
          },
        ),
      );
    }
  }

  const cutoff = ymdToUtcDate(addDaysYmd(ymdInTimeZone("Europe/Istanbul"), -HOURLY_RETENTION_DAYS));
  await prisma.hourlySpend.deleteMany({ where: { date: { lt: cutoff } } });

  return summary;
}

const LOCK_SERVICE = "cron";
const LOCK_OBJECTIVE = "hourly_sync";
const STALE_RUNNING_MS = 20 * 60 * 1000;

export type HourlySyncState = {
  running: boolean;
  lastSuccessAt: string | null;
  lastError: string | null;
};

async function lockTenantId(): Promise<string | null> {
  const t = await prisma.tenant.findFirst({
    where: { visible: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return t?.id ?? null;
}

/** Kilit satırı — günlük sync ile aynı desen (tek SyncJob, meta/cron/hourly_sync). */
export async function getHourlySyncState(): Promise<HourlySyncState> {
  const tenantId = await lockTenantId();
  if (!tenantId) return { running: false, lastSuccessAt: null, lastError: null };
  const lock = await prisma.syncJob.findUnique({
    where: {
      tenantId_provider_service_objective: {
        tenantId,
        provider: "meta",
        service: LOCK_SERVICE,
        objective: LOCK_OBJECTIVE,
      },
    },
  });
  const running =
    lock?.status === "running" &&
    lock.updatedAt.getTime() > Date.now() - STALE_RUNNING_MS;
  return {
    running,
    lastSuccessAt: lock?.lastSuccessAt?.toISOString() ?? null,
    lastError: lock?.status === "error" ? lock.error : null,
  };
}

/**
 * Kilitli çalıştırma — zamanlayıcı ve "Şimdi güncelle" aynı yoldan geçer,
 * üst üste binmez. minIntervalMs içinde başarılı çalıştıysa atlar.
 */
export async function runLockedHourlySync(opts?: {
  minIntervalMs?: number;
}): Promise<{ skipped?: string; summary?: HourlySyncSummary }> {
  const tenantId = await lockTenantId();
  if (!tenantId) return { skipped: "Görünür marka yok." };
  const key = {
    tenantId_provider_service_objective: {
      tenantId,
      provider: "meta" as const,
      service: LOCK_SERVICE,
      objective: LOCK_OBJECTIVE,
    },
  };
  const lock = await prisma.syncJob.findUnique({ where: key });
  const now = Date.now();
  if (lock?.status === "running" && lock.updatedAt.getTime() > now - STALE_RUNNING_MS) {
    return { skipped: "Saatlik senkron zaten çalışıyor." };
  }
  if (
    opts?.minIntervalMs &&
    lock?.lastSuccessAt &&
    lock.lastSuccessAt.getTime() > now - opts.minIntervalMs
  ) {
    return { skipped: "Bu saat zaten çekildi." };
  }

  await prisma.syncJob.upsert({
    where: key,
    update: { status: "running", error: null },
    create: {
      tenantId,
      provider: "meta",
      service: LOCK_SERVICE,
      objective: LOCK_OBJECTIVE,
      status: "running",
    },
  });
  try {
    const summary = await runHourlySync();
    await prisma.syncJob.update({
      where: key,
      data: {
        status: "success",
        lastSuccessAt: new Date(),
        error: summary.failed.length
          ? `Kısmi hata: ${summary.failed.map((f) => `${f.slug}/${f.step}`).join(", ")}`.slice(0, 1000)
          : null,
      },
    });
    return { summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.syncJob.update({
      where: key,
      data: { status: "error", error: message, lastErrorAt: new Date() },
    });
    throw err;
  }
}
