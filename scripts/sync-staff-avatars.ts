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

/**
 * Kişi → S3’te fotoğrafın bulunduğu anahtar. E-posta biliniyorsa onunla,
 * bilinmiyorsa staff içinde ada göre (tek eşleşme şartıyla) bulunur.
 */
const AVATARS: Array<{ label: string; email?: string; name?: RegExp; key: string }> = [
  { label: "Admin", email: "admin@593emarketing.com", key: "avatars/cmtr0r2bw0012pi4wgh1cmv3e.webp" },
  { label: "Sevde", email: "sevde@593emarketing.com", key: "avatars/cmupft6yw0006ml1f3yjqpfbs.webp" },
  { label: "Hüseyin", email: "huseyin@593emarketing.com", key: "avatars/cmupfu0wg0009ml1fnmkz04yh.webp" },
  { label: "Sudenas", email: "sudenas@593emarketing.com", key: "avatars/cmupfuit9000cml1ffpbef5i7.webp" },
  { label: "Numan", email: "numan@593emarketing.com", key: "avatars/cmupfz9740000n41gjwprw29e.webp" },
  { label: "Hakan Kandemir", name: /hakan|kandemir/i, key: "avatars/seedhakan.webp" },
  { label: "Muhammet Akpınar", name: /muhammet|akp[iı]nar/i, key: "avatars/seedmhmmetak.webp" },
];

async function findUser(entry: (typeof AVATARS)[number]) {
  const select = { id: true, email: true, avatarUrl: true } as const;
  if (entry.email) {
    const byEmail = await prisma.user.findUnique({ where: { email: entry.email }, select });
    if (byEmail || !entry.name) return { user: byEmail, note: "kullanıcı yok" };
  }
  const staff = await prisma.user.findMany({
    where: { role: { in: ["admin", "team"] } },
    select: { ...select, name: true },
  });
  const hits = staff.filter(
    (u) => entry.name!.test(u.name ?? "") || entry.name!.test(u.email.split("@")[0]!),
  );
  if (hits.length === 1) return { user: hits[0]!, note: "" };
  return {
    user: null,
    note: hits.length === 0
      ? "adla eşleşen kullanıcı yok"
      : `birden çok eşleşme (${hits.map((h) => h.email).join(", ")})`,
  };
}

const prisma = new PrismaClient();

async function main() {
  // Yerelde .env’den okunur; canlıda değişkenler zaten ortamda.
  await import("dotenv/config").catch(() => {});
  if (!s3Enabled()) {
    throw new Error("S3_BUCKET tanımlı değil — S3 ortam değişkenlerini ekleyin.");
  }
  const force = process.argv.includes("--force");

  for (const entry of AVATARS) {
    const sourceKey = entry.key;
    const { user, note } = await findUser(entry);
    if (!user) {
      console.log(`– ${entry.label}: ${note}, atlandı`);
      continue;
    }
    const email = `${entry.label} <${user.email}>`;
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
