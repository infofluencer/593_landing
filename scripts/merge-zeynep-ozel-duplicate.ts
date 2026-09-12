/**
 * Duplicate Zeynep Özel cleanup:
 * - Keep: zeynep-ozel-bridal (Tamam / e-ticaret)
 * - Merge Meta (+ missing bits) from zeynep-ozel → keep
 * - Delete zeynep-ozel
 * - Rename keep → zeynep-ozel (map / URL uyumu)
 *
 *   DATABASE_URL=... npx tsx scripts/merge-zeynep-ozel-duplicate.ts
 */
import { PrismaClient } from "@prisma/client";

const KEEP_SLUG = "zeynep-ozel-bridal";
const DROP_SLUG = "zeynep-ozel";
const FINAL_SLUG = "zeynep-ozel";

const prisma = new PrismaClient();

async function main() {
  const keep = await prisma.tenant.findUnique({
    where: { slug: KEEP_SLUG },
    include: { mapping: true },
  });
  const drop = await prisma.tenant.findUnique({
    where: { slug: DROP_SLUG },
    include: { mapping: true },
  });

  if (!keep) throw new Error(`Keep tenant yok: ${KEEP_SLUG}`);
  if (!drop) {
    console.log(`Drop tenant yok (${DROP_SLUG}) — zaten temiz.`);
    if (keep.slug !== FINAL_SLUG) {
      await prisma.tenant.update({
        where: { id: keep.id },
        data: { slug: FINAL_SLUG },
      });
      console.log(`Renamed ${KEEP_SLUG} → ${FINAL_SLUG}`);
    }
    return;
  }

  console.log("Keep:", keep.slug, keep.metaAccountId, keep.type);
  console.log("Drop:", drop.slug, drop.metaAccountId, drop.type);

  // Prefer real act_ on keep
  let metaAccountId = keep.metaAccountId;
  const dropMetaOk =
    drop.metaAccountId.startsWith("act_") &&
    !/[a-z]/i.test(drop.metaAccountId.slice(4));
  const keepMetaOk =
    keep.metaAccountId.startsWith("act_") &&
    !/[a-z]/i.test(keep.metaAccountId.slice(4));
  if (!keepMetaOk && dropMetaOk) {
    metaAccountId = drop.metaAccountId;
  }

  // Move Meta insights (unique: tenantId+date+campaignId+objective)
  const insights = await prisma.metaInsight.findMany({
    where: { tenantId: drop.id },
  });
  let movedInsights = 0;
  for (const row of insights) {
    await prisma.metaInsight.upsert({
      where: {
        tenantId_date_campaignId_objective: {
          tenantId: keep.id,
          date: row.date,
          campaignId: row.campaignId,
          objective: row.objective,
        },
      },
      create: {
        tenantId: keep.id,
        date: row.date,
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        objective: row.objective,
        spend: row.spend,
        impressions: row.impressions,
        reach: row.reach,
        frequency: row.frequency,
        clicks: row.clicks,
        ctr: row.ctr,
        cpc: row.cpc,
        actions: row.actions ?? {},
        actionValues: row.actionValues ?? {},
        conversions: row.conversions,
        convValue: row.convValue,
        cpa: row.cpa,
        roas: row.roas,
        ctrOrigin: row.ctrOrigin,
        cpcOrigin: row.cpcOrigin,
        cpaOrigin: row.cpaOrigin,
        roasOrigin: row.roasOrigin,
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
        actions: row.actions ?? {},
        actionValues: row.actionValues ?? {},
        conversions: row.conversions,
        convValue: row.convValue,
        cpa: row.cpa,
        roas: row.roas,
        ctrOrigin: row.ctrOrigin,
        cpcOrigin: row.cpcOrigin,
        cpaOrigin: row.cpaOrigin,
        roasOrigin: row.roasOrigin,
      },
    });
    movedInsights++;
  }
  console.log(`Meta insights upserted: ${movedInsights}`);

  // Move Meta ads
  const ads = await prisma.metaAd.findMany({ where: { tenantId: drop.id } });
  let movedAds = 0;
  for (const row of ads) {
    await prisma.metaAd.upsert({
      where: {
        tenantId_adId: { tenantId: keep.id, adId: row.adId },
      },
      create: {
        tenantId: keep.id,
        adId: row.adId,
        adName: row.adName,
        adsetId: row.adsetId,
        adsetName: row.adsetName,
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        status: row.status,
        effectiveStatus: row.effectiveStatus,
        creativeId: row.creativeId,
        thumbnailUrl: row.thumbnailUrl,
        imageUrl: row.imageUrl,
        permalinkUrl: row.permalinkUrl,
        linkUrl: row.linkUrl,
        objectType: row.objectType,
        syncedAt: row.syncedAt,
      },
      update: {
        adName: row.adName,
        adsetId: row.adsetId,
        adsetName: row.adsetName,
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        status: row.status,
        effectiveStatus: row.effectiveStatus,
        creativeId: row.creativeId,
        thumbnailUrl: row.thumbnailUrl,
        imageUrl: row.imageUrl,
        permalinkUrl: row.permalinkUrl,
        linkUrl: row.linkUrl,
        objectType: row.objectType,
        syncedAt: row.syncedAt,
      },
    });
    movedAds++;
  }
  console.log(`Meta ads upserted: ${movedAds}`);

  // Move Meta ad insights
  const adInsights = await prisma.metaAdInsight.findMany({
    where: { tenantId: drop.id },
  });
  let movedAdInsights = 0;
  for (const row of adInsights) {
    await prisma.metaAdInsight.upsert({
      where: {
        tenantId_date_adId: {
          tenantId: keep.id,
          date: row.date,
          adId: row.adId,
        },
      },
      create: {
        tenantId: keep.id,
        date: row.date,
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
        actions: row.actions ?? {},
        actionValues: row.actionValues ?? {},
        conversions: row.conversions,
        convValue: row.convValue,
        cpa: row.cpa,
        roas: row.roas,
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
        actions: row.actions ?? {},
        actionValues: row.actionValues ?? {},
        conversions: row.conversions,
        convValue: row.convValue,
        cpa: row.cpa,
        roas: row.roas,
      },
    });
    movedAdInsights++;
  }
  console.log(`Meta ad insights upserted: ${movedAdInsights}`);

  // Fill empty Google mapping fields on keep from drop
  if (keep.mapping && drop.mapping) {
    await prisma.tenantMapping.update({
      where: { tenantId: keep.id },
      data: {
        adsCustomerId:
          keep.mapping.adsCustomerId || drop.mapping.adsCustomerId,
        ga4PropertyId:
          keep.mapping.ga4PropertyId || drop.mapping.ga4PropertyId,
        gtmContainerId:
          keep.mapping.gtmContainerId || drop.mapping.gtmContainerId,
        gscSiteUrl: keep.mapping.gscSiteUrl || drop.mapping.gscSiteUrl,
        merchantId: keep.mapping.merchantId || drop.mapping.merchantId,
      },
    });
  }

  // Move client memberships that aren't already on keep
  const dropMembers = await prisma.membership.findMany({
    where: { tenantId: drop.id },
  });
  for (const m of dropMembers) {
    const exists = await prisma.membership.findUnique({
      where: {
        userId_tenantId: { userId: m.userId, tenantId: keep.id },
      },
    });
    if (!exists) {
      await prisma.membership.update({
        where: { id: m.id },
        data: { tenantId: keep.id },
      });
    }
  }

  // Sync jobs: delete drop's (keep's remain)
  await prisma.syncJob.deleteMany({ where: { tenantId: drop.id } });

  // metaAccountId is UNIQUE — free it on drop before assigning to keep
  if (metaAccountId !== keep.metaAccountId) {
    await prisma.tenant.update({
      where: { id: drop.id },
      data: { metaAccountId: `__freed_${drop.id}` },
    });
    await prisma.tenant.update({
      where: { id: keep.id },
      data: { metaAccountId },
    });
    console.log(`metaAccountId → ${metaAccountId}`);
  }

  // Free slug: delete drop first
  await prisma.tenant.delete({ where: { id: drop.id } });
  console.log(`Deleted ${DROP_SLUG}`);

  // Canonical slug for maps
  await prisma.tenant.update({
    where: { id: keep.id },
    data: {
      slug: FINAL_SLUG,
      name: keep.name.includes("Zeynep") ? keep.name : "Zeynep Özel Bridal",
      type: "ecommerce",
    },
  });
  console.log(`Renamed keep → ${FINAL_SLUG} (ecommerce)`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
