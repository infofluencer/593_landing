import type { Prisma, SiteVerifyStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { useMockPanelData } from "@/lib/integrations/tokens";
import {
  runSiteVerification,
  type SiteVerifyResult,
} from "@/lib/panel/site-verify";
import { runSynced } from "@/lib/panel/sync-job";
import { upsertOpenAlert } from "@/lib/panel/alerts-engine";

export async function verifyTenantSite(opts: {
  tenantId: string;
}): Promise<SiteVerifyResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: opts.tenantId },
    include: { mapping: true },
  });
  if (!tenant) throw new Error("Tenant not found");
  if (!tenant.website) {
    const result: SiteVerifyResult = {
      status: "unknown",
      summary: "Tenant.website yok — site açılamadı, test edilmedi.",
      scenarios: [],
      findings: { url: "", expectedGtmPublicId: null },
      error: "website missing",
    };
    await persistVerification(tenant.id, result);
    return result;
  }

  const synced = await runSynced(
    {
      tenantId: tenant.id,
      provider: "google",
      service: "gtm",
      objective: "site_verify",
    },
    async () => {
      const result = await runSiteVerification({
        website: tenant.website!,
        gtmContainerId: tenant.mapping?.gtmContainerId,
        mock: useMockPanelData(),
      });
      if (result.status === "unknown" && result.error) {
        throw new Error(result.error);
      }
      if (result.status === "fail") {
        // Still persist as success SyncJob with fail site status — site was tested
      }
      await persistVerification(tenant.id, result);

      if (result.status === "fail" || result.status === "partial") {
        await upsertOpenAlert({
          tenantId: tenant.id,
          type: "site_tag_verify",
          severity: result.status === "fail" ? "critical" : "warn",
          message: result.summary,
        });
      }

      return result;
    },
  );

  if (!synced.ok) {
    const result: SiteVerifyResult = {
      status: "error",
      summary: `Site testi hatası: ${synced.error}`,
      scenarios: [],
      findings: {
        url: tenant.website,
        expectedGtmPublicId: null,
      },
      error: synced.error,
    };
    await persistVerification(tenant.id, result);
    return result;
  }

  return synced.data;
}

async function persistVerification(
  tenantId: string,
  result: SiteVerifyResult,
) {
  const status = result.status as SiteVerifyStatus;
  await prisma.siteVerification.upsert({
    where: { tenantId },
    update: {
      status,
      checkedAt: new Date(),
      summary: result.summary,
      scenarios: result.scenarios as unknown as Prisma.InputJsonValue,
      findings: result.findings as unknown as Prisma.InputJsonValue,
      error: result.error,
    },
    create: {
      tenantId,
      status,
      checkedAt: new Date(),
      summary: result.summary,
      scenarios: result.scenarios as unknown as Prisma.InputJsonValue,
      findings: result.findings as unknown as Prisma.InputJsonValue,
      error: result.error,
    },
  });
}
