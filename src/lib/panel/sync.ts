import type { Prisma, TenantType } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  fetchGoogleAdsCampaignMetrics,
  fetchGoogleAdsConversionActions,
} from "@/lib/integrations/google/ads";
import { fetchGa4Snapshot } from "@/lib/integrations/google/ga4";
import { fetchGtmSnapshot } from "@/lib/integrations/google/gtm";
import { fetchSearchConsoleQuery } from "@/lib/integrations/google/gsc";
import { fetchMerchantProductIssues } from "@/lib/integrations/google/merchant";
import { fetchMetaCampaignInsights } from "@/lib/integrations/meta/insights";
import { provisionTenantsFromMeta } from "@/lib/integrations/meta/provision";
import { SECRET_REFS } from "@/lib/integrations/secrets";
import {
  IntegrationNotConfiguredError,
  getGoogleAdsLoginCustomerId,
  getMetaSystemUserToken,
} from "@/lib/integrations/tokens";
import { evaluateTenantAlerts } from "@/lib/panel/alerts-engine";
import { resolveAdsCustomerId } from "@/lib/panel/google-ads-customer-map";
import { syncLookbackRange } from "@/lib/panel/period";
import { runSynced } from "@/lib/panel/sync-job";
import { verifyTenantSite } from "@/lib/panel/verify-tenant-site";

function classifyConversion(
  name: string,
): "whatsapp" | "form" | "sale" | "other" {
  const n = name.toLowerCase();
  if (n.includes("whatsapp") || n.includes("wa ") || n.includes("messaging"))
    return "whatsapp";
  if (n.includes("form") || n.includes("lead") || n.includes("randevu"))
    return "form";
  if (
    n.includes("purchase") ||
    n.includes("sale") ||
    n.includes("satış") ||
    n.includes("sipariş")
  )
    return "sale";
  return "other";
}

export type SyncSummary = {
  provision: Awaited<ReturnType<typeof provisionTenantsFromMeta>>;
  tenants: Array<{
    slug: string;
    services: Record<string, { ok: boolean; error?: string }>;
  }>;
};

async function ensureGoogleConnection() {
  try {
    const loginCustomerId = getGoogleAdsLoginCustomerId();
    await prisma.agencyConnection.upsert({
      where: { provider: "google" },
      update: {
        oauthTokenRef: SECRET_REFS.googleRefreshToken,
        loginCustomerId,
      },
      create: {
        provider: "google",
        oauthTokenRef: SECRET_REFS.googleRefreshToken,
        loginCustomerId,
      },
    });
  } catch (err) {
    if (!(err instanceof IntegrationNotConfiguredError)) throw err;
  }
}

async function ensureMetaConnection() {
  try {
    getMetaSystemUserToken();
    await prisma.agencyConnection.upsert({
      where: { provider: "meta" },
      update: { oauthTokenRef: SECRET_REFS.metaSystemUser },
      create: {
        provider: "meta",
        oauthTokenRef: SECRET_REFS.metaSystemUser,
        businessId: process.env.META_BUSINESS_ID?.trim() || null,
      },
    });
  } catch (err) {
    if (!(err instanceof IntegrationNotConfiguredError)) throw err;
  }
}

/**
 * Full agency sync: Meta provision → per-tenant reads → optional site verify → alerts.
 * Failures mark SyncJob.error and never invent zero metrics.
 *
 * siteVerify:
 * - yalnızca açıkça true (GTM “Sitede test et” / API body)
 * - veya SITE_VERIFY_ON_SYNC=true (ajans geneli, yavaş)
 * Veriyi yenile butonu site testi ÇAĞIRMAZ.
 */
export async function runAgencySync(opts?: {
  tenantSlug?: string;
  siteVerify?: boolean;
}): Promise<SyncSummary> {
  await ensureGoogleConnection();
  await ensureMetaConnection();
  const provision = await provisionTenantsFromMeta();

  const tenants = await prisma.tenant.findMany({
    where: {
      visible: true,
      ...(opts?.tenantSlug ? { slug: opts.tenantSlug } : {}),
    },
    include: { mapping: true },
  });

  const envVerify = process.env.SITE_VERIFY_ON_SYNC === "true";
  const doSiteVerify = opts?.siteVerify === true || envVerify;

  const { from, to } = await syncLookbackRange();
  const summary: SyncSummary["tenants"] = [];

  for (const tenant of tenants) {
    const services: SyncSummary["tenants"][number]["services"] = {};
    const mapping = tenant.mapping;
    const adsCustomerId = resolveAdsCustomerId(tenant);

    // --- Meta insights (paid only) ---
    const meta = await runSynced(
      {
        tenantId: tenant.id,
        provider: "meta",
        service: "insights",
        objective: "campaign_daily",
      },
      async () => {
        if (!tenant.metaAccountId) {
          throw new Error("metaAccountId yok — kontrol edilemedi, 0 yazılmadı.");
        }
        const rows = await fetchMetaCampaignInsights({
          metaAccountId: tenant.metaAccountId,
          from,
          to,
          tenantType: tenant.type as TenantType,
        });

        for (const row of rows) {
          await prisma.metaInsight.upsert({
            where: {
              tenantId_date_campaignId_objective: {
                tenantId: tenant.id,
                date: new Date(row.date),
                campaignId: row.campaignId,
                objective: row.objective || "unknown",
              },
            },
            update: {
              campaignName: row.campaignName,
              spend: row.spend,
              impressions: row.impressions,
              reach: row.reach,
              frequency: row.frequency,
              clicks: row.clicks,
              ctr: row.ctr,
              cpc: row.cpc,
              actions: row.actions as Prisma.InputJsonValue,
              actionValues: row.actionValues as Prisma.InputJsonValue,
              conversions: row.conversions,
              convValue: row.convValue,
              cpa: row.cpa,
              roas: row.roas,
              cpaOrigin: "derived",
              roasOrigin: tenant.type === "ecommerce" ? "derived" : "derived",
            },
            create: {
              tenantId: tenant.id,
              date: new Date(row.date),
              campaignId: row.campaignId,
              campaignName: row.campaignName,
              objective: row.objective || "unknown",
              spend: row.spend,
              impressions: row.impressions,
              reach: row.reach,
              frequency: row.frequency,
              clicks: row.clicks,
              ctr: row.ctr,
              cpc: row.cpc,
              actions: row.actions as Prisma.InputJsonValue,
              actionValues: row.actionValues as Prisma.InputJsonValue,
              conversions: row.conversions,
              convValue: row.convValue,
              cpa: row.cpa,
              roas: row.roas,
              cpaOrigin: "derived",
              roasOrigin: "derived",
            },
          });
        }

        // Aggregate Meta conversion kinds for conversions table
        await prisma.conversion.deleteMany({
          where: {
            tenantId: tenant.id,
            date: { gte: new Date(from), lte: new Date(to) },
            source: "Meta Ads",
          },
        });

        let purchase = 0;
        let lead = 0;
        let messaging = 0;
        for (const row of rows) {
          purchase += Number(
            (row.actions.purchase ?? 0) +
              (row.actions.omni_purchase ?? 0) +
              (row.actions["offsite_conversion.fb_pixel_purchase"] ?? 0),
          );
          lead += Number(
            (row.actions.lead ?? 0) +
              (row.actions["onsite_conversion.lead_grouped"] ?? 0) +
              (row.actions["offsite_conversion.fb_pixel_lead"] ?? 0),
          );
          messaging += Number(
            (row.actions["onsite_conversion.messaging_conversation_started_7d"] ??
              0) + (row.actions.messaging_conversation_started_7d ?? 0),
          );
        }

        const metaConvRows: Array<{
          name: string;
          kind: "sale" | "form" | "whatsapp";
          count: number;
        }> = [];
        if (tenant.type === "ecommerce" && purchase > 0) {
          metaConvRows.push({
            name: "Meta omni_purchase",
            kind: "sale",
            count: Math.round(purchase),
          });
        }
        if (lead > 0) {
          metaConvRows.push({
            name: "Meta lead",
            kind: "form",
            count: Math.round(lead),
          });
        }
        if (messaging > 0) {
          metaConvRows.push({
            name: "WhatsApp konuşma",
            kind: "whatsapp",
            count: Math.round(messaging),
          });
        }

        for (const c of metaConvRows) {
          await prisma.conversion.create({
            data: {
              tenantId: tenant.id,
              date: new Date(to),
              name: c.name,
              source: "Meta Ads",
              primary: true,
              count: c.count,
              kind: c.kind,
              dupeFlag: false,
            },
          });
        }

        return rows.length;
      },
    );
    services.meta = meta.ok ? { ok: true } : { ok: false, error: meta.error };

    // --- Google Ads ---
    if (!adsCustomerId) {
      await runSynced(
        {
          tenantId: tenant.id,
          provider: "google",
          service: "ads",
          objective: "campaign_daily",
        },
        async () => {
          throw new Error(
            "adsCustomerId yok — google-ads-customer-map / TenantMapping eksik (0 yazılmadı).",
          );
        },
      );
      services.ads = { ok: false, error: "adsCustomerId eksik" };
    } else {
      const ads = await runSynced(
        {
          tenantId: tenant.id,
          provider: "google",
          service: "ads",
          objective: "campaign_daily",
        },
        async () => {
          const rows = await fetchGoogleAdsCampaignMetrics({
            customerId: adsCustomerId,
            from,
            to,
          });

          for (const row of rows) {
            const cost = row.spend;
            const cpa = row.conv > 0 ? cost / row.conv : null;
            const roas = cost > 0 ? row.convValue / cost : null;
            await prisma.googleAdsMetric.upsert({
              where: {
                tenantId_date_campaignId: {
                  tenantId: tenant.id,
                  date: new Date(row.date),
                  campaignId: row.campaignId,
                },
              },
              update: {
                campaignName: row.campaign,
                cost,
                impressions: row.impr,
                clicks: row.clicks,
                conversions: row.conv,
                convValue: row.convValue,
                cpa,
                roas,
                cpaOrigin: "derived",
                roasOrigin: "derived",
              },
              create: {
                tenantId: tenant.id,
                date: new Date(row.date),
                campaignId: row.campaignId,
                campaignName: row.campaign,
                cost,
                impressions: row.impr,
                clicks: row.clicks,
                conversions: row.conv,
                convValue: row.convValue,
                cpa,
                roas,
                cpaOrigin: "derived",
                roasOrigin: "derived",
              },
            });
          }

          const actions = await fetchGoogleAdsConversionActions({
            customerId: adsCustomerId,
            from,
            to,
          });

          await prisma.conversion.deleteMany({
            where: {
              tenantId: tenant.id,
              date: { gte: new Date(from), lte: new Date(to) },
              source: "Google Ads",
            },
          });

          const nameCounts = new Map<string, number>();
          for (const a of actions) {
            nameCounts.set(
              a.name.toLowerCase(),
              (nameCounts.get(a.name.toLowerCase()) ?? 0) + 1,
            );
          }

          for (const a of actions) {
            const kind = classifyConversion(a.name);
            const dupeFlag =
              (nameCounts.get(a.name.toLowerCase()) ?? 0) > 1 ||
              /ga4|import/i.test(a.name);
            await prisma.conversion.create({
              data: {
                tenantId: tenant.id,
                date: new Date(to),
                name: a.name,
                source: a.source,
                primary: a.primary,
                count: Math.round(a.count),
                kind,
                dupeFlag,
              },
            });
          }

          return rows.length;
        },
      );
      services.ads = ads.ok ? { ok: true } : { ok: false, error: ads.error };
    }

    // --- GA4 (persist) ---
    if (!mapping?.ga4PropertyId) {
      await runSynced(
        {
          tenantId: tenant.id,
          provider: "google",
          service: "ga4",
          objective: "overview",
        },
        async () => {
          throw new Error("ga4PropertyId yok — kontrol edilemedi.");
        },
      );
      services.ga4 = { ok: false, error: "ga4PropertyId eksik" };
    } else {
      const ga4 = await runSynced(
        {
          tenantId: tenant.id,
          provider: "google",
          service: "ga4",
          objective: "overview",
        },
        async () => {
          const snap = await fetchGa4Snapshot({
            propertyId: mapping.ga4PropertyId!,
            from,
            to,
            ecommerce: tenant.type === "ecommerce",
          });

          const periodDate = new Date(to);

          await prisma.ga4Metric.deleteMany({
            where: {
              tenantId: tenant.id,
              date: { gte: new Date(from), lte: new Date(to) },
            },
          });

          await prisma.ga4Metric.create({
            data: {
              tenantId: tenant.id,
              date: periodDate,
              dimensionType: "overview",
              dimensionValue: "",
              totalUsers: snap.overview.totalUsers,
              sessions: snap.overview.sessions,
              averageSessionDuration: snap.overview.averageSessionDuration,
              bounceRate: snap.overview.bounceRate,
              screenPageViewsPerSession:
                snap.overview.screenPageViewsPerSession,
              sessionConversionRate: snap.overview.sessionConversionRate,
              purchaseRevenue: snap.overview.purchaseRevenue,
              transactions: snap.overview.transactions,
            },
          });

          for (const ch of snap.channels) {
            await prisma.ga4Metric.create({
              data: {
                tenantId: tenant.id,
                date: periodDate,
                dimensionType: "channel",
                dimensionValue: ch.dimension,
                sessions: ch.sessions,
                totalUsers: ch.users,
                sessionConversionRate:
                  ch.sessions > 0 ? ch.conversions / ch.sessions : null,
              },
            });
          }

          for (const lp of snap.landings) {
            await prisma.ga4Metric.create({
              data: {
                tenantId: tenant.id,
                date: periodDate,
                dimensionType: "landing",
                dimensionValue: lp.dimension.slice(0, 500),
                sessions: lp.sessions,
                totalUsers: lp.users,
                sessionConversionRate:
                  lp.sessions > 0 ? lp.conversions / lp.sessions : null,
              },
            });
          }

          return snap.channels.length;
        },
      );
      services.ga4 = ga4.ok ? { ok: true } : { ok: false, error: ga4.error };
    }

    // --- GTM ---
    if (!mapping?.gtmContainerId) {
      await runSynced(
        {
          tenantId: tenant.id,
          provider: "google",
          service: "gtm",
          objective: "config",
        },
        async () => {
          throw new Error("gtmContainerId yok — kontrol edilemedi.");
        },
      );
      services.gtm = { ok: false, error: "gtmContainerId eksik" };
    } else if (mapping.gtmContainerId.includes("/")) {
      const [accountId, containerId] = mapping.gtmContainerId.split("/");
      const gtm = await runSynced(
        {
          tenantId: tenant.id,
          provider: "google",
          service: "gtm",
          objective: "config",
        },
        () => fetchGtmSnapshot({ accountId, containerId }),
      );
      services.gtm = gtm.ok ? { ok: true } : { ok: false, error: gtm.error };
    } else {
      await runSynced(
        {
          tenantId: tenant.id,
          provider: "google",
          service: "gtm",
          objective: "config",
        },
        async () => {
          throw new Error(
            "gtmContainerId formatı accountsId/containerId olmalı (örn. 123/456).",
          );
        },
      );
      services.gtm = { ok: false, error: "gtmContainerId formatı hatalı" };
    }

    // --- Search Console ---
    if (mapping?.gscSiteUrl) {
      const gsc = await runSynced(
        {
          tenantId: tenant.id,
          provider: "google",
          service: "gsc",
          objective: "query",
        },
        () =>
          fetchSearchConsoleQuery({
            siteUrl: mapping.gscSiteUrl!,
            from,
            to,
          }),
      );
      services.gsc = gsc.ok ? { ok: true } : { ok: false, error: gsc.error };
    }

    // --- Merchant (ecommerce only) ---
    if (tenant.type === "ecommerce" && mapping?.merchantId) {
      const merch = await runSynced(
        {
          tenantId: tenant.id,
          provider: "google",
          service: "merchant",
          objective: "product_status",
        },
        () => fetchMerchantProductIssues({ merchantId: mapping.merchantId! }),
      );
      services.merchant = merch.ok
        ? { ok: true }
        : { ok: false, error: merch.error };
    }

    // --- Site tag verify (Playwright) — optional / single-tenant ---
    if (doSiteVerify && tenant.website) {
      try {
        const site = await verifyTenantSite({ tenantId: tenant.id });
        services.site_verify = {
          ok: site.status === "pass" || site.status === "partial",
          error:
            site.status === "fail" ||
            site.status === "error" ||
            site.status === "unknown"
              ? site.summary
              : undefined,
        };
      } catch (err) {
        services.site_verify = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    await evaluateTenantAlerts(tenant.id);
    summary.push({ slug: tenant.slug, services });
  }

  return { provision, tenants: summary };
}
