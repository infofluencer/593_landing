import type { Provider } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeMetaViewUrl } from "@/lib/integrations/meta/billing";

export type BillingChargeRow = {
  id: string;
  provider: Provider;
  externalId: string;
  amount: number;
  currency: string;
  chargedAt: string;
  status: string;
  viewUrl: string | null;
  invoiceNumber: string | null;
};

export async function getTenantBillingCharges(
  tenantId: string,
  opts: { from: string; to: string; provider?: Provider },
): Promise<BillingChargeRow[]> {
  const from = new Date(`${opts.from}T00:00:00+03:00`);
  const to = new Date(`${opts.to}T23:59:59.999+03:00`);

  const rows = await prisma.billingCharge.findMany({
    where: {
      tenantId,
      chargedAt: { gte: from, lte: to },
      ...(opts.provider ? { provider: opts.provider } : {}),
    },
    orderBy: { chargedAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    externalId: r.externalId,
    amount: Number(r.amount),
    currency: r.currency,
    chargedAt: r.chargedAt.toISOString(),
    status: r.status,
    viewUrl:
      r.provider === "meta" ? normalizeMetaViewUrl(r.viewUrl) : r.viewUrl,
    invoiceNumber: r.invoiceNumber,
  }));
}

export async function getBillingSyncHints(tenantId: string): Promise<{
  metaError: string | null;
  googleError: string | null;
  metaOkAt: string | null;
  googleOkAt: string | null;
}> {
  const jobs = await prisma.syncJob.findMany({
    where: {
      tenantId,
      service: "billing",
      objective: "charges",
    },
  });
  const meta = jobs.find((j) => j.provider === "meta");
  const google = jobs.find((j) => j.provider === "google");
  return {
    metaError: meta?.status === "error" ? meta.error : null,
    googleError: google?.status === "error" ? google.error : null,
    metaOkAt: meta?.lastSuccessAt?.toISOString() ?? null,
    googleOkAt: google?.lastSuccessAt?.toISOString() ?? null,
  };
}
