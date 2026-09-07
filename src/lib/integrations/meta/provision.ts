import { prisma } from "@/lib/db";
import { listBusinessAdAccounts } from "@/lib/integrations/meta/accounts";
import { SECRET_REFS } from "@/lib/integrations/secrets";
import { uniqueSlug } from "@/lib/integrations/slugify";
import {
  IntegrationNotConfiguredError,
  getMetaBusinessId,
} from "@/lib/integrations/tokens";

export type ProvisionResult = {
  upserted: number;
  accounts: { metaAccountId: string; slug: string; name: string }[];
  skipped: boolean;
  reason?: string;
};

/**
 * Pull BM owned+client ad accounts and upsert Tenants (metaAccountId = source of truth).
 * Does not create tenants by hand — only from Meta.
 */
export async function provisionTenantsFromMeta(): Promise<ProvisionResult> {
  try {
    const businessId = getMetaBusinessId();

    await prisma.agencyConnection.upsert({
      where: { provider: "meta" },
      update: {
        oauthTokenRef: SECRET_REFS.metaSystemUser,
        businessId,
      },
      create: {
        provider: "meta",
        oauthTokenRef: SECRET_REFS.metaSystemUser,
        businessId,
      },
    });

    const accounts = await listBusinessAdAccounts();
    const results: ProvisionResult["accounts"] = [];

    for (const account of accounts) {
      const metaAccountId = account.id.startsWith("act_")
        ? account.id
        : `act_${account.account_id}`;
      const desiredSlug = uniqueSlug(
        account.name || metaAccountId,
        account.account_id || metaAccountId,
      );

      const existing = await prisma.tenant.findUnique({
        where: { metaAccountId },
      });

      let slug = existing?.slug ?? desiredSlug;
      if (!existing) {
        const clash = await prisma.tenant.findUnique({ where: { slug } });
        if (clash) {
          slug = uniqueSlug(`${desiredSlug}-x`, metaAccountId);
        }
      }

      const tenant = await prisma.tenant.upsert({
        where: { metaAccountId },
        update: {
          name: account.name || existing?.name || metaAccountId,
          currency: account.currency || existing?.currency || "TRY",
          timezone:
            account.timezone_name || existing?.timezone || "Europe/Istanbul",
          visible: true,
        },
        create: {
          slug,
          name: account.name || metaAccountId,
          metaAccountId,
          currency: account.currency || "TRY",
          timezone: account.timezone_name || "Europe/Istanbul",
          visible: true,
          mapping: { create: {} },
          thresholds: { create: {} },
        },
      });

      await prisma.tenantThreshold.upsert({
        where: { tenantId: tenant.id },
        update: {},
        create: { tenantId: tenant.id },
      });

      results.push({
        metaAccountId: tenant.metaAccountId,
        slug: tenant.slug,
        name: tenant.name,
      });
    }

    return { upserted: results.length, accounts: results, skipped: false };
  } catch (err) {
    // Meta kurulumu yok / yarım / Graph hatası — ajans sync'ini (Google vb.) engelleme.
    const reason =
      err instanceof IntegrationNotConfiguredError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    return {
      upserted: 0,
      accounts: [],
      skipped: true,
      reason,
    };
  }
}
