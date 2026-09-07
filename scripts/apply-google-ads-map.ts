/**
 * Upsert TenantMapping.adsCustomerId from code map (slug / name).
 * Usage (app container or local with DATABASE_URL):
 *   npx tsx scripts/apply-google-ads-map.ts
 */
import { PrismaClient } from "@prisma/client";
import { resolveAdsCustomerId } from "../src/lib/panel/google-ads-customer-map";

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({ include: { mapping: true } });
  let updated = 0;
  let skipped = 0;

  for (const t of tenants) {
    const adsCustomerId = resolveAdsCustomerId(t);
    if (!adsCustomerId) {
      console.log(`skip  ${t.slug} (${t.name}) — map'te yok`);
      skipped++;
      continue;
    }

    await prisma.tenantMapping.upsert({
      where: { tenantId: t.id },
      update: { adsCustomerId },
      create: {
        tenantId: t.id,
        adsCustomerId,
        ga4PropertyId: null,
        gtmContainerId: null,
        gscSiteUrl: null,
        merchantId: null,
      },
    });
    console.log(`ok    ${t.slug} → ${adsCustomerId}`);
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
