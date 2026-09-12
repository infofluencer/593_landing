/**
 * Zeynep Özel duplicate cleanup (one-shot, after deploy):
 *
 * Keep  : zeynep-ozel-bridal (Tamam / ecommerce + data)
 * Drop  : zeynep-ozel (incomplete lead)
 * Final : rename keep → zeynep-ozel, real Meta act_
 *
 * Container:
 *   cd /app && npx tsx scripts/merge-zeynep-ozel-duplicate.ts
 */
import { PrismaClient } from "@prisma/client";

const KEEP_SLUG = "zeynep-ozel-bridal";
const DROP_SLUG = "zeynep-ozel";
const FINAL_SLUG = "zeynep-ozel";
/** Canonical Meta ad account (BM / map). */
const CANONICAL_META = "act_276161233026397";

const prisma = new PrismaClient();

function isRealMetaAct(id: string): boolean {
  return id.startsWith("act_") && !/[a-z]/i.test(id.slice(4));
}

async function main() {
  const keep = await prisma.tenant.findUnique({
    where: { slug: KEEP_SLUG },
    include: { mapping: true },
  });
  const drop = await prisma.tenant.findUnique({
    where: { slug: DROP_SLUG },
    include: { mapping: true },
  });

  // Already merged to final slug?
  if (!keep) {
    const final = await prisma.tenant.findUnique({
      where: { slug: FINAL_SLUG },
    });
    if (final) {
      const meta = isRealMetaAct(final.metaAccountId)
        ? final.metaAccountId
        : CANONICAL_META;
      if (final.metaAccountId !== meta || final.type !== "ecommerce") {
        await prisma.tenant.update({
          where: { id: final.id },
          data: { metaAccountId: meta, type: "ecommerce" },
        });
      }
      console.log("Already on", FINAL_SLUG, meta, final.type);
      console.log("Done.");
      return;
    }
    throw new Error(`Keep tenant yok: ${KEEP_SLUG} ve ${FINAL_SLUG}`);
  }

  if (!drop) {
    console.log(`Drop yok (${DROP_SLUG}) — sadece keep güncelleniyor.`);
    const meta = isRealMetaAct(keep.metaAccountId)
      ? keep.metaAccountId
      : CANONICAL_META;
    // Free slug collision if somehow FINAL exists empty — shouldn't
    await prisma.tenant.update({
      where: { id: keep.id },
      data: {
        slug: FINAL_SLUG,
        metaAccountId: meta,
        type: "ecommerce",
        name: keep.name.includes("Zeynep") ? keep.name : "Zeynep Özel Bridal",
      },
    });
    console.log("OK:", FINAL_SLUG, meta);
    console.log("Done.");
    return;
  }

  console.log("Keep:", keep.slug, keep.metaAccountId, keep.type);
  console.log("Drop:", drop.slug, drop.metaAccountId, drop.type);

  let metaAccountId = keep.metaAccountId;
  if (!isRealMetaAct(keep.metaAccountId) && isRealMetaAct(drop.metaAccountId)) {
    metaAccountId = drop.metaAccountId;
  } else if (!isRealMetaAct(keep.metaAccountId)) {
    metaAccountId = CANONICAL_META;
  }

  // Move Meta insights
  const insights = await prisma.metaInsight.findMany({
    where: { tenantId: drop.id },
  });
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
  }
  console.log(`Meta insights upserted: ${insights.length}`);

  // Move Meta ads (creatives)
  const ads = await prisma.metaAd.findMany({ where: { tenantId: drop.id } });
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
  }
  console.log(`Meta ads upserted: ${ads.length}`);

  // Move Meta ad insights
  const adInsights = await prisma.metaAdInsight.findMany({
    where: { tenantId: drop.id },
  });
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
  }
  console.log(`Meta ad insights upserted: ${adInsights.length}`);

  // Mapping: fill empties from drop
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
  } else if (!keep.mapping && drop.mapping) {
    await prisma.tenantMapping.create({
      data: {
        tenantId: keep.id,
        adsCustomerId: drop.mapping.adsCustomerId,
        ga4PropertyId: drop.mapping.ga4PropertyId,
        gtmContainerId: drop.mapping.gtmContainerId,
        gscSiteUrl: drop.mapping.gscSiteUrl,
        merchantId: drop.mapping.merchantId,
      },
    });
  }

  // Memberships
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

  await prisma.syncJob.deleteMany({ where: { tenantId: drop.id } });

  // UNIQUE metaAccountId: free drop first, then assign to keep
  if (metaAccountId !== keep.metaAccountId) {
    await prisma.tenant.update({
      where: { id: drop.id },
      data: { metaAccountId: `__freed_${drop.id}` },
    });
    await prisma.tenant.update({
      where: { id: keep.id },
      data: { metaAccountId, type: "ecommerce" },
    });
    console.log(`metaAccountId → ${metaAccountId}`);
  } else {
    await prisma.tenant.update({
      where: { id: keep.id },
      data: { type: "ecommerce" },
    });
  }

  await prisma.tenant.delete({ where: { id: drop.id } });
  console.log(`Deleted ${DROP_SLUG}`);

  await prisma.tenant.update({
    where: { id: keep.id },
    data: {
      slug: FINAL_SLUG,
      name: keep.name.includes("Zeynep") ? keep.name : "Zeynep Özel Bridal",
      type: "ecommerce",
    },
  });
  console.log(`OK: ${FINAL_SLUG} ${metaAccountId} ecommerce`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
