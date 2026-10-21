/**
 * Ekip profil fotoğraflarını S3’teki hazır dosyalardan e-postaya göre bağlar.
 * Fotoğraflar yerelde yüklendi (S3: avatars/<yerel-id>.webp); canlıda kullanıcı
 * id’leri farklı olabileceğinden dosya canlı id’ye kopyalanır ve avatarUrl yazılır.
 * Tekrar çalıştırmak güvenli: fotoğrafı olan kullanıcı atlanır (--force ile ezilir).
 *
 *   npx tsx scripts/sync-staff-avatars.ts [--force]
 */
import { PrismaClient } from "@prisma/client";
import { s3Enabled, s3Put, s3SignedGetUrl } from "../src/lib/storage/s3";

/** e-posta → S3’te fotoğrafın bulunduğu anahtar. */
const AVATARS: Record<string, string> = {
  "sevde@593emarketing.com": "avatars/cmupft6yw0006ml1f3yjqpfbs.webp",
  "huseyin@593emarketing.com": "avatars/cmupfu0wg0009ml1fnmkz04yh.webp",
  "sudenas@593emarketing.com": "avatars/cmupfuit9000cml1ffpbef5i7.webp",
  "numan@593emarketing.com": "avatars/cmupfz9740000n41gjwprw29e.webp",
};

const prisma = new PrismaClient();

async function main() {
  // Yerelde .env’den okunur; canlıda değişkenler zaten ortamda.
  await import("dotenv/config").catch(() => {});
  if (!s3Enabled()) {
    throw new Error("S3_BUCKET tanımlı değil — S3 ortam değişkenlerini ekleyin.");
  }
  const force = process.argv.includes("--force");

  for (const [email, sourceKey] of Object.entries(AVATARS)) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, avatarUrl: true },
    });
    if (!user) {
      console.log(`– ${email}: kullanıcı yok, atlandı`);
      continue;
    }
    if (user.avatarUrl && !force) {
      console.log(`– ${email}: zaten fotoğrafı var, atlandı`);
      continue;
    }

    const targetKey = `avatars/${user.id}.webp`;
    if (targetKey !== sourceKey) {
      const res = await fetch(await s3SignedGetUrl(sourceKey));
      if (!res.ok) {
        console.log(`✕ ${email}: S3’te ${sourceKey} okunamadı (${res.status})`);
        continue;
      }
      await s3Put(targetKey, Buffer.from(await res.arrayBuffer()), "image/webp");
    }
    const avatarUrl = `/uploads/${targetKey}?v=${Date.now()}`;
    await prisma.user.update({ where: { id: user.id }, data: { avatarUrl } });
    console.log(`✓ ${email} → ${avatarUrl}`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
