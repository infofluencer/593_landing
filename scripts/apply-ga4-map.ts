/**
 * Upsert TenantMapping.ga4PropertyId from code map (not DB-first resolve).
 *   npm run db:apply-ga4-map
 */
import { PrismaClient } from "@prisma/client";
import { ga4PropertyIdFromCodeMap } from "../src/lib/panel/ga4-property-map";

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({ include: { mapping: true } });
  let updated = 0;
  let skipped = 0;

  for (const t of tenants) {
    const ga4PropertyId = ga4PropertyIdFromCodeMap(t);
    if (!ga4PropertyId) {
      console.log(`skip  ${t.slug} (${t.name}) — map'te yok`);
      skipped++;
      continue;
    }

    const prev = t.mapping?.ga4PropertyId ?? null;
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
    console.log(
      prev && prev !== ga4PropertyId
        ? `ok    ${t.slug} ${prev} → ${ga4PropertyId}`
        : `ok    ${t.slug} → ${ga4PropertyId}`,
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
