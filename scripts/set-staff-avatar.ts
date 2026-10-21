/**
 * Ekip üyesine profil fotoğrafı ata.
 *   npx tsx scripts/set-staff-avatar.ts <email> <görsel-yolu>
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { saveStaffAvatar } from "../src/lib/panel/staff-avatar";

const prisma = new PrismaClient();

async function main() {
  const [email, file] = process.argv.slice(2);
  if (!email || !file) {
    throw new Error("Kullanım: set-staff-avatar.ts <email> <görsel-yolu>");
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Kullanıcı yok: ${email}`);
  const avatarUrl = await saveStaffAvatar(user.id, await readFile(file));
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl } });
  console.log(`${email} → ${avatarUrl}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
