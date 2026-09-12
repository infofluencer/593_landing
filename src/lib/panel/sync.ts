import type { Prisma, TenantType } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  fetchGoogleAdsCampaignMetrics,
  fetchGoogleAdsConversionActions,
} from "@/lib/integrations/google/ads";
import { fetchGa4Snapshot } from "@/lib/integrations/google/ga4";
import { fetchGtmSnapshotResolved } from "@/lib/integrations/google/gtm";
import { fetchSearchConsoleQuery } from "@/lib/integrations/google/gsc";
import { fetchMerchantProductIssues } from "@/lib/integrations/google/merchant";
import {
  fetchMetaAdInsights,
  fetchMetaAdsWithCreatives,
  fetchMetaAdsetInsights,
  fetchMetaBreakdownInsights,
} from "@/lib/integrations/meta/ads";
import { fetchMetaCampaignInsights } from "@/lib/integrations/meta/insights";
import { provisionTenantsFromMeta } from "@/lib/integrations/meta/provision";
import type { ProvisionResult } from "@/lib/integrations/meta/provision";
import { SECRET_REFS } from "@/lib/integrations/secrets";
import {
  IntegrationNotConfiguredError,
  getGoogleAdsLoginCustomerId,
  getMetaSystemUserToken,
} from "@/lib/integrations/tokens";
import { evaluateTenantAlerts } from "@/lib/panel/alerts-engine";
import { resolveAdsCustomerId, adsCustomerIdFromCodeMap } from "@/lib/panel/google-ads-customer-map";
import {
  metaAccountIdFromCodeMap,
  resolveMetaAccountId,
} from "@/lib/panel/meta-ad-account-map";
import {
  isPlaceholderAdsCustomerId,
  isPlaceholderMerchantId,
  isPlaceholderMetaAccountId,
} from "@/lib/panel/mapping-placeholders";
import { resolveGa4PropertyId } from "@/lib/panel/ga4-property-map";
import { resolveGtmApiRef } from "@/lib/panel/gtm-container-map";
import { syncLookbackRange } from "@/lib/panel/period";
import { runSynced } from "@/lib/panel/sync-job";
import { verifyTenantSite } from "@/lib/panel/verify-tenant-site";
import { classifyConversion } from "@/lib/panel/classify-conversion";

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
 * providers:
 * - "meta" → BM provision + Meta insights
 * - "google" → Ads / GA4 / GTM / GSC / Merchant
 * Varsayılan: ikisi birden (geriye dönük).
 *
 * siteVerify:
 * - yalnızca açıkça true (GTM “Sitede test et” / API body)
 * - veya SITE_VERIFY_ON_SYNC=true (ajans geneli, yavaş)
 */
export type SyncProvider = "meta" | "google";

export async function runAgencySync(opts?: {
  tenantSlug?: string;
  siteVerify?: boolean;
  providers?: SyncProvider[];
}): Promise<SyncSummary> {
  const providers = new Set<SyncProvider>(
    opts?.providers?.length ? opts.providers : ["meta", "google"],
  );
  const doMeta = providers.has("meta");
  const doGoogle = providers.has("google");

  if (doGoogle) await ensureGoogleConnection();
  if (doMeta) await ensureMetaConnection();

  const provision: ProvisionResult = doMeta
    ? await provisionTenantsFromMeta()
    : {
        upserted: 0,
        accounts: [],
        skipped: true,
        reason: "Meta sync seçilmedi",
      };

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
    let adsCustomerId = resolveAdsCustomerId(tenant);
    const mapAdsId = adsCustomerIdFromCodeMap(tenant);

    // Heal mock placeholder Ads IDs in DB so Settings/UI match sync.
    if (
      mapAdsId &&
      mapping?.adsCustomerId &&
      isPlaceholderAdsCustomerId(mapping.adsCustomerId)
    ) {
      await prisma.tenantMapping.update({
        where: { tenantId: tenant.id },
        data: { adsCustomerId: mapAdsId },
      });
      adsCustomerId = mapAdsId;
    }

    let metaAccountId = resolveMetaAccountId(tenant);
    const mapMetaId = metaAccountIdFromCodeMap(tenant);
    // Heal placeholder Meta act_ from code map (DB Settings wins when real).
    if (mapMetaId && isPlaceholderMetaAccountId(tenant.metaAccountId)) {
      const clash = await prisma.tenant.findFirst({
        where: { metaAccountId: mapMetaId, NOT: { id: tenant.id } },
      });
      if (!clash) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { metaAccountId: mapMetaId },
        });
        tenant.metaAccountId = mapMetaId;
        metaAccountId = mapMetaId;
      }
    }

    // --- Meta insights (paid only) ---
    if (doMeta) {
      const meta = await runSynced(
        {
          tenantId: tenant.id,
          provider: "meta",
          service: "insights",
          objective: "campaign_daily",
        },
        async () => {
          if (!metaAccountId) {
            throw new Error(
              "metaAccountId yok — meta-ad-account-map / Tenant eksik (0 yazılmadı).",
            );
          }
          const rows = await fetchMetaCampaignInsights({
            metaAccountId,
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
            // omni öncelikli — aynı satışı purchase+omni+offsite ile üçleme
            const p =
              Number(row.actions.omni_purchase ?? 0) ||
              Number(row.actions.purchase ?? 0) ||
              Number(
                row.actions["offsite_conversion.fb_pixel_purchase"] ?? 0,
              ) ||
              Number(row.actions.onsite_web_purchase ?? 0) ||
              Number(row.actions["onsite_conversion.purchase"] ?? 0);
            purchase += p;
            lead += Number(
              (row.actions.lead ?? 0) +
                (row.actions["onsite_conversion.lead_grouped"] ?? 0) +
                (row.actions["offsite_conversion.fb_pixel_lead"] ?? 0) +
                (row.actions.onsite_web_lead ?? 0),
            );
            messaging += Number(
              (row.actions[
                "onsite_conversion.messaging_conversation_started_7d"
              ] ?? 0) + (row.actions.messaging_conversation_started_7d ?? 0),
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

      const metaAds = await runSynced(
        {
          tenantId: tenant.id,
          provider: "meta",
          service: "ads",
          objective: "ad_daily",
        },
        async () => {
          if (!metaAccountId) {
            throw new Error(
              "metaAccountId yok — reklam/kreatif çekilemedi, 0 yazılmadı.",
            );
          }

          const creatives = await fetchMetaAdsWithCreatives({
            metaAccountId,
          });
          const syncedAt = new Date();
          for (const ad of creatives) {
            await prisma.metaAd.upsert({
              where: {
                tenantId_adId: {
                  tenantId: tenant.id,
                  adId: ad.adId,
                },
              },
              update: {
                adName: ad.adName,
                adsetId: ad.adsetId,
                adsetName: ad.adsetName,
                campaignId: ad.campaignId,
                campaignName: ad.campaignName,
                status: ad.status,
                effectiveStatus: ad.effectiveStatus,
                creativeId: ad.creativeId,
                thumbnailUrl: ad.thumbnailUrl,
                imageUrl: ad.imageUrl,
                permalinkUrl: ad.permalinkUrl,
                linkUrl: ad.linkUrl,
                objectType: ad.objectType,
                syncedAt,
              },
              create: {
                tenantId: tenant.id,
                adId: ad.adId,
                adName: ad.adName,
                adsetId: ad.adsetId,
                adsetName: ad.adsetName,
                campaignId: ad.campaignId,
                campaignName: ad.campaignName,
                status: ad.status,
                effectiveStatus: ad.effectiveStatus,
                creativeId: ad.creativeId,
                thumbnailUrl: ad.thumbnailUrl,
                imageUrl: ad.imageUrl,
                permalinkUrl: ad.permalinkUrl,
                linkUrl: ad.linkUrl,
                objectType: ad.objectType,
                syncedAt,
              },
            });
          }

          const adRows = await fetchMetaAdInsights({
            metaAccountId,
            from,
            to,
            tenantType: tenant.type as TenantType,
          });

          for (const row of adRows) {
            await prisma.metaAdInsight.upsert({
              where: {
                tenantId_date_adId: {
                  tenantId: tenant.id,
                  date: new Date(row.date),
                  adId: row.adId,
                },
              },
              update: {
                adName: row.adName,
                campaignId: row.campaignId,
                campaignName: row.campaignName,
                adsetId: row.adsetId,
                adsetName: row.adsetName,
                spend: row.spend,
                impressions: row.impressions,
                reach: row.reach,
                clicks: row.clicks,
                ctr: row.ctr,
                cpc: row.cpc,
                actions: row.actions as Prisma.InputJsonValue,
                actionValues: row.actionValues as Prisma.InputJsonValue,
                conversions: row.conversions,
                convValue: row.convValue,
                cpa: row.cpa,
                roas: row.roas,
              },
              create: {
                tenantId: tenant.id,
                date: new Date(row.date),
                adId: row.adId,
                adName: row.adName,
                campaignId: row.campaignId,
                campaignName: row.campaignName,
                adsetId: row.adsetId,
                adsetName: row.adsetName,
                spend: row.spend,
                impressions: row.impressions,
                reach: row.reach,
                clicks: row.clicks,
                ctr: row.ctr,
                cpc: row.cpc,
                actions: row.actions as Prisma.InputJsonValue,
                actionValues: row.actionValues as Prisma.InputJsonValue,
                conversions: row.conversions,
                convValue: row.convValue,
                cpa: row.cpa,
                roas: row.roas,
              },
            });
          }

          const adsetRows = await fetchMetaAdsetInsights({
            metaAccountId,
            from,
            to,
            tenantType: tenant.type as TenantType,
          });
          for (const row of adsetRows) {
            await prisma.metaAdsetInsight.upsert({
              where: {
                tenantId_date_adsetId: {
                  tenantId: tenant.id,
                  date: new Date(row.date),
                  adsetId: row.adsetId,
                },
              },
              update: {
                adsetName: row.adsetName,
                campaignId: row.campaignId,
                campaignName: row.campaignName,
                spend: row.spend,
                impressions: row.impressions,
                reach: row.reach,
                clicks: row.clicks,
                ctr: row.ctr,
                cpc: row.cpc,
                actions: row.actions as Prisma.InputJsonValue,
                actionValues: row.actionValues as Prisma.InputJsonValue,
                conversions: row.conversions,
                convValue: row.convValue,
                cpa: row.cpa,
                roas: row.roas,
              },
              create: {
                tenantId: tenant.id,
                date: new Date(row.date),
                adsetId: row.adsetId,
                adsetName: row.adsetName,
                campaignId: row.campaignId,
                campaignName: row.campaignName,
                spend: row.spend,
                impressions: row.impressions,
                reach: row.reach,
                clicks: row.clicks,
                ctr: row.ctr,
                cpc: row.cpc,
                actions: row.actions as Prisma.InputJsonValue,
                actionValues: row.actionValues as Prisma.InputJsonValue,
                conversions: row.conversions,
                convValue: row.convValue,
                cpa: row.cpa,
                roas: row.roas,
              },
            });
          }

          const breakdownRows = await fetchMetaBreakdownInsights({
            metaAccountId,
            from,
            to,
            tenantType: tenant.type as TenantType,
          });
          for (const row of breakdownRows) {
            await prisma.metaBreakdownInsight.upsert({
              where: {
                tenantId_date_breakdown_key: {
                  tenantId: tenant.id,
                  date: new Date(row.date),
                  breakdown: row.breakdown,
                  key: row.key,
                },
              },
              update: {
                spend: row.spend,
                impressions: row.impressions,
                reach: row.reach,
                clicks: row.clicks,
                conversions: row.conversions,
                convValue: row.convValue,
              },
              create: {
                tenantId: tenant.id,
                date: new Date(row.date),
                breakdown: row.breakdown,
                key: row.key,
                spend: row.spend,
                impressions: row.impressions,
                reach: row.reach,
                clicks: row.clicks,
                conversions: row.conversions,
                convValue: row.convValue,
              },
            });
          }

          return {
            creatives: creatives.length,
            insights: adRows.length,
            adsets: adsetRows.length,
            breakdowns: breakdownRows.length,
          };
        },
      );
      services.metaAds = metaAds.ok
        ? { ok: true }
        : { ok: false, error: metaAds.error };
    }

    if (doGoogle) {
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
            async function persistAds(customerId: string) {
              const rows = await fetchGoogleAdsCampaignMetrics({
                customerId,
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
                customerId,
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
            }

            try {
              return await persistAds(adsCustomerId);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              const mapId = adsCustomerIdFromCodeMap(tenant);
              const notFound = /CUSTOMER_NOT_FOUND|No customer found/i.test(
                msg,
              );
              if (!notFound || !mapId || mapId === adsCustomerId) throw err;

              await prisma.tenantMapping.upsert({
                where: { tenantId: tenant.id },
                update: { adsCustomerId: mapId },
                create: {
                  tenantId: tenant.id,
                  adsCustomerId: mapId,
                },
              });
              return await persistAds(mapId);
            }
          },
        );
        services.ads = ads.ok ? { ok: true } : { ok: false, error: ads.error };
      }

      // --- GA4 (persist) ---
      const ga4PropertyId = resolveGa4PropertyId(tenant);
      if (!ga4PropertyId) {
        await runSynced(
          {
            tenantId: tenant.id,
            provider: "google",
            service: "ga4",
            objective: "overview",
          },
          async () => {
            throw new Error("ga4PropertyId yok — map / Ayarlar eksik.");
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
              propertyId: ga4PropertyId,
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
      const gtmRef = resolveGtmApiRef(tenant);
      if (!gtmRef) {
        await runSynced(
          {
            tenantId: tenant.id,
            provider: "google",
            service: "gtm",
            objective: "config",
          },
          async () => {
            throw new Error("GTM container yok — map / Ayarlar eksik.");
          },
        );
        services.gtm = { ok: false, error: "GTM container eksik" };
      } else {
        const gtm = await runSynced(
          {
            tenantId: tenant.id,
            provider: "google",
            service: "gtm",
            objective: "config",
          },
          async () => {
            const { snapshot, path } = await fetchGtmSnapshotResolved(gtmRef);
            // Public ID tarama kotasını kesmek için numeric path’i DB’ye yaz.
            const numeric = `${path.accountId}/${path.containerId}`;
            if (tenant.mapping?.gtmContainerId !== numeric) {
              await prisma.tenantMapping.upsert({
                where: { tenantId: tenant.id },
                update: { gtmContainerId: numeric },
                create: {
                  tenantId: tenant.id,
                  gtmContainerId: numeric,
                },
              });
            }
            return snapshot.tags.length;
          },
        );
        services.gtm = gtm.ok ? { ok: true } : { ok: false, error: gtm.error };
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
        if (isPlaceholderMerchantId(mapping.merchantId)) {
          await prisma.tenantMapping.update({
            where: { tenantId: tenant.id },
            data: { merchantId: null },
          });
          // Skip API — mock/non-numeric ID; gerçek Merchant Center ID Ayarlar’dan.
        } else {
          const merch = await runSynced(
            {
              tenantId: tenant.id,
              provider: "google",
              service: "merchant",
              objective: "product_status",
            },
            () =>
              fetchMerchantProductIssues({ merchantId: mapping.merchantId! }),
          );
          services.merchant = merch.ok
            ? { ok: true }
            : { ok: false, error: merch.error };
        }
      }
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
