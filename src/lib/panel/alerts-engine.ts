import type { AlertSeverity, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type HistoryEntry = {
  at: string;
  action: string;
  by?: string | null;
  note?: string | null;
};

function asHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value as HistoryEntry[];
}

export async function upsertOpenAlert(opts: {
  tenantId: string;
  type: string;
  severity: AlertSeverity;
  message: string;
}) {
  const existing = await prisma.alert.findFirst({
    where: {
      tenantId: opts.tenantId,
      type: opts.type,
      resolved: false,
    },
  });

  if (existing) {
    return prisma.alert.update({
      where: { id: existing.id },
      data: {
        severity: opts.severity,
        message: opts.message,
        updatedAt: new Date(),
      },
    });
  }

  const history: HistoryEntry[] = [
    {
      at: new Date().toISOString(),
      action: "created",
      note: opts.message,
    },
  ];

  return prisma.alert.create({
    data: {
      tenantId: opts.tenantId,
      type: opts.type,
      severity: opts.severity,
      message: opts.message,
      history: history as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Threshold evaluation using Google Ads + Meta spend (combined).
 * Low volume below minSpendForAlert does not create noise.
 */
export async function evaluateTenantAlerts(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      thresholds: true,
      mapping: true,
      syncJobs: true,
      googleAdsMetrics: { orderBy: { date: "desc" }, take: 90 },
      metaInsights: { orderBy: { date: "desc" }, take: 90 },
    },
  });
  if (!tenant) return;

  const thresholds = tenant.thresholds ?? {
    budgetPaceWarnPct: 85,
    convDropoutDays: 3,
    minSpendForAlert: 100 as unknown as { toString: () => string },
  };

  const minSpend = Number(
    typeof thresholds.minSpendForAlert === "object" &&
      thresholds.minSpendForAlert &&
      "toString" in thresholds.minSpendForAlert
      ? thresholds.minSpendForAlert.toString()
      : thresholds.minSpendForAlert,
  );

  const budget = tenant.monthlyBudget ? Number(tenant.monthlyBudget) : null;
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  const mtdGoogle = tenant.googleAdsMetrics.filter((m) => m.date >= monthStart);
  const mtdMeta = tenant.metaInsights.filter((m) => m.date >= monthStart);
  const mtdSpend =
    mtdGoogle.reduce((s, m) => s + Number(m.cost), 0) +
    mtdMeta.reduce((s, m) => s + Number(m.spend), 0);
  const mtdConv =
    mtdGoogle.reduce((s, m) => s + Number(m.conversions), 0) +
    mtdMeta.reduce((s, m) => s + Number(m.conversions ?? 0), 0);

  if (!tenant.mapping?.adsCustomerId) {
    await upsertOpenAlert({
      tenantId,
      type: "missing_mapping",
      severity: "unknown",
      message: "Google Ads müşteri ID eşleştirilmemiş — veri çekilemedi.",
    });
  }

  const adsJob = tenant.syncJobs.find(
    (j) => j.provider === "google" && j.service === "ads",
  );
  if (adsJob?.status === "error") {
    await upsertOpenAlert({
      tenantId,
      type: "sync_error",
      severity: "unknown",
      message: `Ads sync hatası: ${adsJob.error || "bilinmeyen"}`,
    });
  }

  const metaJob = tenant.syncJobs.find(
    (j) => j.provider === "meta" && j.service === "insights",
  );
  if (metaJob?.status === "error") {
    await upsertOpenAlert({
      tenantId,
      type: "sync_error_meta",
      severity: "unknown",
      message: `Meta insights hatası: ${metaJob.error || "bilinmeyen"}`,
    });
  }

  const ga4Job = tenant.syncJobs.find(
    (j) => j.provider === "google" && j.service === "ga4",
  );
  if (ga4Job?.status === "error") {
    await upsertOpenAlert({
      tenantId,
      type: "sync_error_ga4",
      severity: "unknown",
      message: `GA4 sync hatası: ${ga4Job.error || "bilinmeyen"}`,
    });
  }

  if (budget && budget > 0 && mtdSpend >= minSpend) {
    const day = now.getUTCDate();
    const daysInMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const expectedPct = (day / daysInMonth) * 100;
    const actualPct = (mtdSpend / budget) * 100;
    const warnPct = thresholds.budgetPaceWarnPct ?? 85;

    if (actualPct >= warnPct && actualPct > expectedPct + 10) {
      await upsertOpenAlert({
        tenantId,
        type: "spend_pace",
        severity: "warn",
        message: `Ayın ${day}. gününde bütçenin %${actualPct.toFixed(0)}’i harandı (eşik %${warnPct}).`,
      });
    }
  }

  const dropoutDays = thresholds.convDropoutDays ?? 3;
  if (mtdSpend >= minSpend && mtdConv === 0 && now.getUTCDate() >= dropoutDays) {
    await upsertOpenAlert({
      tenantId,
      type: "conv_dropout",
      severity: "critical",
      message: `Harcama var, son dönemde dönüşüm 0 — ölçüm kesintisi şüphesi.`,
    });
  }
}

export async function assignAlert(opts: {
  alertId: string;
  assigneeEmail: string;
  by: string;
}) {
  const alert = await prisma.alert.findUnique({ where: { id: opts.alertId } });
  if (!alert) throw new Error("Alert not found");

  const user = await prisma.user.findUnique({
    where: { email: opts.assigneeEmail.toLowerCase() },
  });

  const history = asHistory(alert.history);
  history.push({
    at: new Date().toISOString(),
    action: "assigned",
    by: opts.by,
    note: opts.assigneeEmail,
  });

  return prisma.alert.update({
    where: { id: opts.alertId },
    data: {
      assigneeId: user?.id ?? null,
      history: history as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function resolveAlert(opts: {
  alertId: string;
  by: string;
  note?: string;
}) {
  const alert = await prisma.alert.findUnique({ where: { id: opts.alertId } });
  if (!alert) throw new Error("Alert not found");

  const history = asHistory(alert.history);
  history.push({
    at: new Date().toISOString(),
    action: "resolved",
    by: opts.by,
    note: opts.note ?? null,
  });

  return prisma.alert.update({
    where: { id: opts.alertId },
    data: {
      resolved: true,
      history: history as unknown as Prisma.InputJsonValue,
    },
  });
}
