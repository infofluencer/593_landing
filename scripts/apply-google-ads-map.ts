/**
 * Upsert TenantMapping.adsCustomerId from code map (slug / name).
 * Usage (app container or local with DATABASE_URL):
 *   npx tsx scripts/apply-google-ads-map.ts
 */
import { PrismaClient } from "@prisma/client";
import { adsCustomerIdFromCodeMap } from "../src/lib/panel/google-ads-customer-map";

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({ include: { mapping: true } });
  let updated = 0;
  let skipped = 0;

  for (const t of tenants) {
    // Always write from code map (not DB-first resolve — that would keep bad DB values).
    const adsCustomerId = adsCustomerIdFromCodeMap(t);
    if (!adsCustomerId) {
      console.log(`skip  ${t.slug} (${t.name}) — map'te yok`);
      skipped++;
      continue;
    }

    const prev = t.mapping?.adsCustomerId?.replace(/-/g, "") ?? null;
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
    console.log(
      prev && prev !== adsCustomerId
        ? `ok    ${t.slug} ${prev} → ${adsCustomerId}`
        : `ok    ${t.slug} → ${adsCustomerId}`,
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
