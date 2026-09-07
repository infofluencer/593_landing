/**
 * Upsert TenantMapping.ga4PropertyId from code map.
 *   npm run db:apply-ga4-map
 */
import { PrismaClient } from "@prisma/client";
import { resolveGa4PropertyId } from "../src/lib/panel/ga4-property-map";

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({ include: { mapping: true } });
  let updated = 0;
  let skipped = 0;

  for (const t of tenants) {
    const ga4PropertyId = resolveGa4PropertyId(t);
    if (!ga4PropertyId) {
      console.log(`skip  ${t.slug} (${t.name}) — map'te yok`);
      skipped++;
      continue;
    }

    await prisma.tenantMapping.upsert({
      where: { tenantId: t.id },
      update: { ga4PropertyId },
      create: {
        tenantId: t.id,
        adsCustomerId: null,
        ga4PropertyId,
        gtmContainerId: null,
        gscSiteUrl: null,
        merchantId: null,
      },
    });
    console.log(`ok    ${t.slug} → ${ga4PropertyId}`);
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
