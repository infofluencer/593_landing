/**
 * Upsert TenantMapping.gtmContainerId from GTM public-id map.
 *   npm run db:apply-gtm-map
 *
 * Real numeric account/container paths are kept (quota). Placeholders are overwritten.
 */
import { PrismaClient } from "@prisma/client";
import {
  gtmPublicIdFromCodeMap,
  isGtmNumericPath,
} from "../src/lib/panel/gtm-container-map";
import { isPlaceholderGtmId } from "../src/lib/panel/mapping-placeholders";

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({ include: { mapping: true } });
  let updated = 0;
  let skipped = 0;

  for (const t of tenants) {
    const existing = t.mapping?.gtmContainerId?.trim() || null;
    if (isGtmNumericPath(existing) && !isPlaceholderGtmId(existing)) {
      console.log(`keep  ${t.slug} → ${existing} (numeric)`);
      skipped++;
      continue;
    }

    const gtmContainerId = gtmPublicIdFromCodeMap(t);
    if (!gtmContainerId) {
      console.log(`skip  ${t.slug} (${t.name}) — map'te yok`);
      skipped++;
      continue;
    }

    await prisma.tenantMapping.upsert({
      where: { tenantId: t.id },
      update: { gtmContainerId },
      create: {
        tenantId: t.id,
        adsCustomerId: null,
        ga4PropertyId: null,
        gtmContainerId,
        gscSiteUrl: null,
        merchantId: null,
      },
    });
    console.log(
      existing && existing !== gtmContainerId
        ? `ok    ${t.slug} ${existing} → ${gtmContainerId}`
        : `ok    ${t.slug} → ${gtmContainerId}`,
    );
    updated++;
  }

  console.log(`\nDone. updated=${updated} skipped=${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
