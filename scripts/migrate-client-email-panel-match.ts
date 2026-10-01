/**
 * Align client login emails with panel slug (subdomain).
 *
 * Rule: email must be `{slug}@{ROOT_DOMAIN}` so host and username match.
 * Mismatch example that breaks login habits:
 *   email ercanyalcin@…  vs  panel ercan-yalcin.…
 *   → people open ercanyalcin.593emarketing.com (tenant yok) and fail.
 *
 * Usage:
 *   npx tsx scripts/migrate-client-email-panel-match.ts          # dry-run
 *   npx tsx scripts/migrate-client-email-panel-match.ts --apply  # write
 *
 * Optional:
 *   --mode=slug   rename tenant.slug → email local-part (Dokploy host değişir)
 *   default mode=email  set email → {slug}@{root} (Dokploy aynı kalır — önerilen)
 */
import { PrismaClient } from "@prisma/client";
import {
  assertClientEmailForPanel,
  clientEmailForPanel,
  emailDomainPart,
  emailLocalPart,
  normalizePanelSlug,
  validatePanelSlug,
} from "../src/lib/panel/client-email";
import { rootDomain } from "../src/lib/panel/host";

const prisma = new PrismaClient();

type Mode = "email" | "slug";

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  const modeArg = argv.find((a) => a.startsWith("--mode="));
  const mode = (modeArg?.split("=")[1] === "slug" ? "slug" : "email") as Mode;
  return { apply, mode };
}

async function main() {
  const { apply, mode } = parseArgs(process.argv.slice(2));
  const domain = rootDomain();

  console.log(
    `mode=${mode} apply=${apply} rootDomain=${domain}\n` +
      (apply ? "WRITING changes\n" : "DRY-RUN — pass --apply to write\n"),
  );

  const clients = await prisma.user.findMany({
    where: { role: "client" },
    include: {
      memberships: {
        include: {
          tenant: { select: { id: true, slug: true, name: true } },
        },
      },
    },
    orderBy: { email: "asc" },
  });

  let fixed = 0;
  let skipped = 0;
  let conflicts = 0;

  for (const user of clients) {
    if (user.memberships.length === 0) {
      console.log(`skip  ${user.email} — no tenant membership`);
      skipped++;
      continue;
    }
    if (user.memberships.length > 1) {
      console.log(
        `skip  ${user.email} — ${user.memberships.length} tenants (manuel)`,
      );
      skipped++;
      continue;
    }

    const tenant = user.memberships[0]!.tenant;
    const matchErr = assertClientEmailForPanel(
      user.email,
      tenant.slug,
      domain,
    );
    if (!matchErr) {
      skipped++;
      continue;
    }

    if (mode === "email") {
      const nextEmail = clientEmailForPanel(tenant.slug, domain);
      if (nextEmail === user.email) {
        skipped++;
        continue;
      }
      const taken = await prisma.user.findUnique({ where: { email: nextEmail } });
      if (taken && taken.id !== user.id) {
        console.log(
          `conflict  ${user.email} → ${nextEmail} (already ${taken.id})`,
        );
        conflicts++;
        continue;
      }
      console.log(
        `${apply ? "ok" : "would"}  email  ${user.email} → ${nextEmail}  [${tenant.slug}]`,
      );
      if (apply) {
        await prisma.user.update({
          where: { id: user.id },
          data: { email: nextEmail },
        });
      }
      fixed++;
      continue;
    }

    // mode === "slug": rename panel address to email local-part
    const local = normalizePanelSlug(emailLocalPart(user.email));
    const host = emailDomainPart(user.email);
    if (host !== domain) {
      // Harici domain — önce e-postayı root’a çek, slug’a hizala
      const nextEmail = clientEmailForPanel(tenant.slug, domain);
      const taken = await prisma.user.findUnique({ where: { email: nextEmail } });
      if (taken && taken.id !== user.id) {
        console.log(`conflict  ${user.email} → ${nextEmail}`);
        conflicts++;
        continue;
      }
      console.log(
        `${apply ? "ok" : "would"}  email(ext)  ${user.email} → ${nextEmail}  [${tenant.slug}]`,
      );
      if (apply) {
        await prisma.user.update({
          where: { id: user.id },
          data: { email: nextEmail },
        });
      }
      fixed++;
      continue;
    }

    const slugErr = validatePanelSlug(local);
    if (slugErr) {
      console.log(`skip  ${user.email} — local not valid slug: ${slugErr}`);
      skipped++;
      continue;
    }
    if (local === tenant.slug) {
      skipped++;
      continue;
    }
    const slugTaken = await prisma.tenant.findUnique({ where: { slug: local } });
    if (slugTaken && slugTaken.id !== tenant.id) {
      console.log(
        `conflict  slug ${tenant.slug} → ${local} (taken by ${slugTaken.name})`,
      );
      conflicts++;
      continue;
    }
    console.log(
      `${apply ? "ok" : "would"}  slug  ${tenant.slug} → ${local}  (email ${user.email})`,
    );
    console.log(
      `         Dokploy: remove ${tenant.slug}.${domain} / add ${local}.${domain}`,
    );
    if (apply) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { slug: local },
      });
    }
    fixed++;
  }

  console.log("\n---");
  console.log({ fixed, skipped, conflicts, apply, mode });
  if (!apply && fixed > 0) {
    console.log("\nRe-run with --apply to write.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
