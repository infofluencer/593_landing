/**
 * Clear mock placeholder Google IDs, then apply Ads / GA4 / GTM code maps.
 *
 *   npm run db:repair-google-maps
 */
import { PrismaClient } from "@prisma/client";
import { adsCustomerIdFromCodeMap } from "../src/lib/panel/google-ads-customer-map";
import { ga4PropertyIdFromCodeMap } from "../src/lib/panel/ga4-property-map";
import {
  gtmPublicIdFromCodeMap,
  isGtmNumericPath,
} from "../src/lib/panel/gtm-container-map";
import {
  isPlaceholderAdsCustomerId,
  isPlaceholderGa4PropertyId,
  isPlaceholderGtmId,
  isPlaceholderMerchantId,
} from "../src/lib/panel/mapping-placeholders";

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({ include: { mapping: true } });
  let cleared = 0;
  let ads = 0;
  let ga4 = 0;
  let gtm = 0;

  for (const t of tenants) {
    const m = t.mapping;
    if (!m) {
      await prisma.tenantMapping.create({
        data: { tenantId: t.id },
      });
    }

    const cur = await prisma.tenantMapping.findUniqueOrThrow({
      where: { tenantId: t.id },
    });

    const nextAds = isPlaceholderAdsCustomerId(cur.adsCustomerId)
      ? null
      : cur.adsCustomerId;
    const nextGa4 = isPlaceholderGa4PropertyId(cur.ga4PropertyId)
      ? null
      : cur.ga4PropertyId;
    const nextGtm = isPlaceholderGtmId(cur.gtmContainerId)
      ? null
      : cur.gtmContainerId;
    const nextMerchant = isPlaceholderMerchantId(cur.merchantId)
      ? null
      : cur.merchantId;

    if (
      nextAds !== cur.adsCustomerId ||
      nextGa4 !== cur.ga4PropertyId ||
      nextGtm !== cur.gtmContainerId ||
      nextMerchant !== cur.merchantId
    ) {
      await prisma.tenantMapping.update({
        where: { tenantId: t.id },
        data: {
          adsCustomerId: nextAds,
          ga4PropertyId: nextGa4,
          gtmContainerId: nextGtm,
          merchantId: nextMerchant,
        },
      });
      cleared++;
      console.log(`clear placeholders  ${t.slug}`);
    }

    const mapAds = adsCustomerIdFromCodeMap(t);
    if (mapAds) {
      await prisma.tenantMapping.update({
        where: { tenantId: t.id },
        data: { adsCustomerId: mapAds },
      });
      ads++;
      console.log(`ads  ${t.slug} → ${mapAds}`);
    }

    const mapGa4 = ga4PropertyIdFromCodeMap(t);
    if (mapGa4) {
      await prisma.tenantMapping.update({
        where: { tenantId: t.id },
        data: { ga4PropertyId: mapGa4 },
      });
      ga4++;
      console.log(`ga4  ${t.slug} → ${mapGa4}`);
    }

    const existingGtm = (
      await prisma.tenantMapping.findUniqueOrThrow({
        where: { tenantId: t.id },
      })
    ).gtmContainerId;
    if (isGtmNumericPath(existingGtm) && !isPlaceholderGtmId(existingGtm)) {
      console.log(`gtm  ${t.slug} keep ${existingGtm}`);
    } else {
      const mapGtm = gtmPublicIdFromCodeMap(t);
      if (mapGtm) {
        await prisma.tenantMapping.update({
          where: { tenantId: t.id },
          data: { gtmContainerId: mapGtm },
        });
        gtm++;
        console.log(`gtm  ${t.slug} → ${mapGtm}`);
      }
    }
  }

  console.log(
    `\nDone. clearedPlaceholders=${cleared} ads=${ads} ga4=${ga4} gtm=${gtm}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
