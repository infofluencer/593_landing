/**
 * Geriye dönük doldurma — aktif (görünür) markalar için 720 gün:
 * Meta kampanya, Google Ads kampanya + dönüşüm aksiyonu (günlük), GA4 günlük.
 * Bu sürümde doldurulmuş markalar atlanır; yarıda kalırsa tekrar çalıştır.
 *
 *   npm run db:backfill-conversions
 *   npm run db:backfill-conversions -- --slug bianne --slug mareen
 *   npm run db:backfill-conversions -- --force      (hepsini yeniden)
 *   npm run db:backfill-conversions -- --list       (yalnızca durum)
 */
try {
  process.loadEnvFile?.(".env");
} catch {
  // prod: ortam değişkenleri zaten tanımlı
}

async function main() {
  const { listBackfillStatus, runConversionBackfill, BACKFILL_VERSION } =
    await import("../src/lib/panel/backfill");
  const { prisma } = await import("../src/lib/db");

  const args = process.argv.slice(2);
  const slugs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--slug" && args[i + 1]) slugs.push(args[++i]!);
  }
  const force = args.includes("--force");

  if (args.includes("--list")) {
    for (const t of await listBackfillStatus()) {
      console.log(
        `${t.slug.padEnd(28)} ${(t.status ?? "—").padEnd(8)} ${t.lastSuccessAt ?? ""} ${t.error ?? ""}`,
      );
    }
    await prisma.$disconnect();
    return;
  }

  console.log(
    `[backfill ${BACKFILL_VERSION}] ${slugs.length ? slugs.join(", ") : "tüm aktif markalar"}${force ? " (force)" : ""}`,
  );
  const started = Date.now();
  const results = await runConversionBackfill({
    slugs,
    force,
    onProgress: (r, i, total) => {
      console.log(
        `[${i}/${total}] ${r.slug}: ${r.status}${r.detail ? ` — ${r.detail}` : ""}`,
      );
    },
  });
  const count = (s: string) => results.filter((r) => r.status === s).length;
  console.log(
    `Bitti (${Math.round((Date.now() - started) / 1000)} sn): ${count("success")} başarılı, ${count("partial")} kısmi, ${count("error")} hata, ${count("skipped")} atlandı.`,
  );
  await prisma.$disconnect();
  if (count("error") > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
