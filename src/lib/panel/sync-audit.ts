import { prisma } from "@/lib/db";
import { istanbulYmd } from "@/lib/date/tr";
import { hasBrandLogo } from "@/lib/panel/brand-logos";
import { useMockPanelData } from "@/lib/integrations/tokens";

export type SyncAuditCall = {
  id: string;
  tenantId: string;
  slug: string;
  brand: string;
  logo: boolean;
  provider: "meta" | "google";
  api: string;
  call: string;
  service: string;
  objective: string;
  status: "pending" | "running" | "success" | "error";
  lastSuccessAt: string | null;
  updatedAt: string;
  error: string | null;
};

export type SyncAuditBrand = {
  id: string;
  slug: string;
  name: string;
  logo: boolean;
  metaLastSuccessAt: string | null;
  googleLastSuccessAt: string | null;
  metaLatestDay: string | null;
  googleLatestDay: string | null;
  metaRows: number;
  googleRows: number;
  metaStatus: SyncAuditCall["status"] | null;
  googleStatus: SyncAuditCall["status"] | null;
};

export type SyncAuditCron = {
  status: SyncAuditCall["status"];
  lastSuccessAt: string | null;
  updatedAt: string | null;
  error: string | null;
};

export type SyncAudit = {
  mock: boolean;
  cron: SyncAuditCron | null;
  brands: SyncAuditBrand[];
  calls: SyncAuditCall[];
  todaySuccess: number;
  errorCount: number;
  logoCount: number;
};

const STATUS = new Set(["pending", "running", "success", "error"]);

function asStatus(value: string): SyncAuditCall["status"] {
  return STATUS.has(value) ? (value as SyncAuditCall["status"]) : "pending";
}

function ymdOf(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

function describeCall(
  provider: "meta" | "google",
  service: string,
  objective: string,
): { api: string; call: string } {
  if (service === "cron" && objective === "daily_sync") {
    return {
      api: "Sistem",
      call: "Otomatik günlük sync (09:00 / 18:00 İstanbul)",
    };
  }
  if (service === "panel_sync") {
    return {
      api: provider === "meta" ? "Meta" : "Google",
      call: "Senkron oturumu",
    };
  }
  if (provider === "meta") {
    if (service === "insights") {
      return {
        api: "Meta Graph",
        call: "GET /{act_id}/insights · campaign · daily",
      };
    }
    if (service === "ad_insights") {
      return {
        api: "Meta Graph",
        call: "GET /{act_id}/insights · ad / adset / breakdown",
      };
    }
    if (service === "ads") {
      return {
        api: "Meta Graph",
        call: "GET /{act_id}/ads · kreatif",
      };
    }
    if (service === "billing") {
      return {
        api: "Meta Graph",
        call: "GET /{act_id}/activities · fatura",
      };
    }
    return { api: "Meta Graph", call: `${service}/${objective}` };
  }
  if (service === "ads") {
    return {
      api: "Google Ads",
      call: "GAQL · campaign metrics · daily",
    };
  }
  if (service === "billing") {
    return { api: "Google Ads", call: "GAQL · invoices" };
  }
  if (service === "ga4") {
    return { api: "GA4 Data API", call: "runReport · overview / channel" };
  }
  if (service === "gtm") {
    return { api: "Tag Manager API", call: "accounts.containers · config" };
  }
  if (service === "gsc") {
    return { api: "Search Console", call: "searchanalytics.query" };
  }
  if (service === "merchant") {
    return { api: "Merchant API", call: "product issues" };
  }
  return { api: "Google", call: `${service}/${objective}` };
}

export async function loadSyncAudit(): Promise<SyncAudit> {
  if (useMockPanelData()) {
    return {
      mock: true,
      cron: null,
      brands: [],
      calls: [],
      todaySuccess: 0,
      errorCount: 0,
      logoCount: 0,
    };
  }

  const tenants = await prisma.tenant.findMany({
    where: { visible: true },
    select: {
      id: true,
      slug: true,
      name: true,
      coverUrl: true,
      syncJobs: {
        orderBy: { updatedAt: "desc" },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const tenantIds = tenants.map((t) => t.id);

  const [metaAgg, googleAgg] = tenantIds.length
    ? await Promise.all([
        prisma.metaInsight.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: tenantIds } },
          _max: { date: true },
          _count: { _all: true },
        }),
        prisma.googleAdsMetric.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: tenantIds } },
          _max: { date: true },
          _count: { _all: true },
        }),
      ])
    : [[], []];

  const metaByTenant = new Map(
    metaAgg.map((row) => [
      row.tenantId,
      { day: ymdOf(row._max.date), rows: row._count._all },
    ]),
  );
  const googleByTenant = new Map(
    googleAgg.map((row) => [
      row.tenantId,
      { day: ymdOf(row._max.date), rows: row._count._all },
    ]),
  );

  const startOfToday = new Date(`${istanbulYmd()}T00:00:00+03:00`);
  let todaySuccess = 0;
  let errorCount = 0;
  let logoCount = 0;

  const brands: SyncAuditBrand[] = [];
  const calls: SyncAuditCall[] = [];
  let cron: SyncAuditCron | null = null;

  for (const t of tenants) {
    const logo = hasBrandLogo({
      slug: t.slug,
      name: t.name,
      coverUrl: t.coverUrl,
    });
    if (logo) logoCount += 1;

    let metaLast: string | null = null;
    let googleLast: string | null = null;
    let metaStatus: SyncAuditCall["status"] | null = null;
    let googleStatus: SyncAuditCall["status"] | null = null;

    for (const job of t.syncJobs) {
      const provider = job.provider === "google" ? "google" : "meta";
      const { api, call } = describeCall(provider, job.service, job.objective);
      const lastSuccessAt = job.lastSuccessAt?.toISOString() ?? null;
      const status = asStatus(job.status);

      if (job.lastSuccessAt && job.lastSuccessAt >= startOfToday) {
        todaySuccess += 1;
      }
      if (status === "error") errorCount += 1;

      if (job.service === "cron" && job.objective === "daily_sync") {
        const next: SyncAuditCron = {
          status,
          lastSuccessAt,
          updatedAt: job.updatedAt.toISOString(),
          error: job.error,
        };
        if (
          !cron ||
          (next.lastSuccessAt &&
            (!cron.lastSuccessAt || next.lastSuccessAt > cron.lastSuccessAt))
        ) {
          cron = next;
        }
      }

      if (
        provider === "meta" &&
        job.service === "insights" &&
        job.objective === "campaign_daily"
      ) {
        metaLast = lastSuccessAt;
        metaStatus = status;
      }
      if (
        provider === "google" &&
        job.service === "ads" &&
        job.objective === "campaign_daily"
      ) {
        googleLast = lastSuccessAt;
        googleStatus = status;
      }

      calls.push({
        id: job.id,
        tenantId: t.id,
        slug: t.slug,
        brand: t.name,
        logo,
        provider,
        api,
        call,
        service: job.service,
        objective: job.objective,
        status,
        lastSuccessAt,
        updatedAt: job.updatedAt.toISOString(),
        error: job.error,
      });
    }

    const meta = metaByTenant.get(t.id);
    const google = googleByTenant.get(t.id);
    brands.push({
      id: t.id,
      slug: t.slug,
      name: t.name,
      logo,
      metaLastSuccessAt: metaLast,
      googleLastSuccessAt: googleLast,
      metaLatestDay: meta?.day ?? null,
      googleLatestDay: google?.day ?? null,
      metaRows: meta?.rows ?? 0,
      googleRows: google?.rows ?? 0,
      metaStatus,
      googleStatus,
    });
  }

  calls.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  return {
    mock: false,
    cron,
    brands,
    calls,
    todaySuccess,
    errorCount,
    logoCount,
  };
}
