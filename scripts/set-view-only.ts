/**
 * Ekip üyesini yalnızca takvimi ve durum panosunu salt okunur görecek şekilde kısıtla (rol ve ekipler değişmez).
 *   npx tsx scripts/set-view-only.ts <email>
 * Geri al:
 *   npx tsx scripts/set-view-only.ts <email> --off
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [rawEmail, flag] = process.argv.slice(2);
  if (!rawEmail || (flag && flag !== "--off")) {
    throw new Error("Kullanım: set-view-only.ts <email> [--off]");
  }
  const email = rawEmail.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Kullanıcı yok: ${email}`);
  if (user.role !== "team") {
    throw new Error(`Yalnızca ekip üyesi kısıtlanabilir: ${email} (${user.role})`);
  }
  const viewOnly = flag !== "--off";
  await prisma.user.update({ where: { id: user.id }, data: { viewOnly } });
  console.log(`${email} → ${viewOnly ? "görüntüleyici (takvim + durum)" : "normal ekip üyesi"}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
