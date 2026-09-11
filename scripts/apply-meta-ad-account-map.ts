/**
 * Upsert Tenant.metaAccountId from code map (slug / name).
 * Usage (app container or local with DATABASE_URL):
 *   npx tsx scripts/apply-meta-ad-account-map.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  metaAccountIdFromCodeMap,
  normalizeMetaAccountId,
} from "../src/lib/panel/meta-ad-account-map";
import { isPlaceholderMetaAccountId } from "../src/lib/panel/mapping-placeholders";

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany();
  let updated = 0;
  let skipped = 0;

  for (const t of tenants) {
    const metaAccountId = metaAccountIdFromCodeMap(t);
    if (!metaAccountId) {
      console.log(`skip  ${t.slug} (${t.name}) — map'te yok`);
      skipped++;
      continue;
    }

    const prev = normalizeMetaAccountId(t.metaAccountId);
    if (
      prev === metaAccountId &&
      !isPlaceholderMetaAccountId(t.metaAccountId)
    ) {
      console.log(`ok    ${t.slug} zaten ${metaAccountId}`);
      updated++;
      continue;
    }

    const clash = await prisma.tenant.findFirst({
      where: {
        metaAccountId,
        NOT: { id: t.id },
      },
    });
    if (clash) {
      console.log(
        `skip  ${t.slug} → ${metaAccountId} çakışıyor (${clash.slug})`,
      );
      skipped++;
      continue;
    }

    await prisma.tenant.update({
      where: { id: t.id },
      data: { metaAccountId },
    });
    console.log(
      prev && prev !== metaAccountId
        ? `ok    ${t.slug} ${prev} → ${metaAccountId}`
        : `ok    ${t.slug} → ${metaAccountId}`,
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
