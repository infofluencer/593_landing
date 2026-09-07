/**
 * Upsert TenantMapping.gtmContainerId from GTM public-id map.
 *   npm run db:apply-gtm-map
 */
import { PrismaClient } from "@prisma/client";
import { resolveGtmPublicId } from "../src/lib/panel/gtm-container-map";

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({ include: { mapping: true } });
  let updated = 0;
  let skipped = 0;

  for (const t of tenants) {
    const gtmContainerId = resolveGtmPublicId(t);
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
    console.log(`ok    ${t.slug} → ${gtmContainerId}`);
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
