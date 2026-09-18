import type { TenantType } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { TenantSettingsInitial } from "@/components/panel/TenantSettingsForm";
import type { MockTenantBundle } from "@/lib/panel/mock-data";

export async function loadTenantSettingsInitial(
  slug: string,
  bundle: MockTenantBundle,
): Promise<{ initial: TenantSettingsInitial; existsInDb: boolean }> {
  const db = await prisma.tenant.findUnique({
    where: { slug },
    include: {
      mapping: true,
      thresholds: true,
      memberships: {
        where: { user: { role: "client" } },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              passwordPlain: true,
            },
          },
        },
      },
    },
  });

  const clientUsers =
    db?.memberships.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      hasPassword: true,
      passwordPlain: m.user.passwordPlain ?? null,
    })) ?? [];

  if (db) {
    return {
      existsInDb: true,
      initial: {
        name: db.name,
        slug: db.slug,
        metaAccountId: db.metaAccountId,
        type: db.type,
        website: db.website ?? "",
        timezone: db.timezone,
        currency: db.currency,
        mapping: {
          adsCustomerId: db.mapping?.adsCustomerId ?? "",
          ga4PropertyId: db.mapping?.ga4PropertyId ?? "",
          gtmContainerId: db.mapping?.gtmContainerId ?? "",
          gscSiteUrl: db.mapping?.gscSiteUrl ?? "",
          merchantId: db.mapping?.merchantId ?? "",
        },
        thresholds: {
          budgetPaceWarnPct: String(db.thresholds?.budgetPaceWarnPct ?? 85),
          convDropoutDays: String(db.thresholds?.convDropoutDays ?? 3),
          minSpendForAlert: String(
            db.thresholds?.minSpendForAlert
              ? Number(db.thresholds.minSpendForAlert)
              : 100,
          ),
        },
        clientUsers,
      },
    };
  }

  return {
    existsInDb: false,
    initial: {
      name: bundle.tenant.name,
      slug: bundle.tenant.slug,
      metaAccountId: bundle.tenant.metaAccountId,
      type: bundle.tenant.type as TenantType,
      website: bundle.tenant.website ?? "",
      timezone: bundle.tenant.timezone,
      currency: bundle.tenant.currency,
      mapping: {
        adsCustomerId: bundle.tenant.mapping.adsCustomerId ?? "",
        ga4PropertyId: bundle.tenant.mapping.ga4PropertyId ?? "",
        gtmContainerId: bundle.tenant.mapping.gtmContainerId ?? "",
        gscSiteUrl: bundle.tenant.mapping.gscSiteUrl ?? "",
        merchantId: bundle.tenant.mapping.merchantId ?? "",
      },
      thresholds: {
        budgetPaceWarnPct: String(bundle.thresholds.budgetPaceWarnPct),
        convDropoutDays: String(bundle.thresholds.convDropoutDays),
        minSpendForAlert: String(bundle.thresholds.minSpendForAlert),
      },
      clientUsers: [],
    },
  };
}
