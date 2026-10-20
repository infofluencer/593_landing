import type { AlertSeverity, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  istanbulYmd,
  startOfIstanbulMonthYmd,
  ymdToUtcDate,
} from "@/lib/date/tr";
import { withoutDisabledJobs } from "@/lib/panel/integrations";
import { notifyAlert, shouldNotifyAlert } from "@/lib/panel/notify";
import { classifySyncError } from "@/lib/panel/sync-error-class";

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

/** Harcama bu kadar gün üst üste sıfırsa "harcama durdu". */
const SPEND_STOP_DAYS = 2;

function daysBetween(fromYmd: string, toYmd: string): number {
  const ms = (ymd: string) =>
    Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));
  return Math.round((ms(toYmd) - ms(fromYmd)) / 86_400_000);
}

function dmy(ymd: string): string {
  return `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}`;
}

function money(n: number, currency: string): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Açık uyarıyı oluşturur / günceller. Yeni açıldığında veya seviyesi
 * yükseldiğinde bildirim (WhatsApp → e-posta) gider; tekrarı notify engeller.
 */
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

  let alertId: string;
  if (existing) {
    const updated = await prisma.alert.update({
      where: { id: existing.id },
      data: {
        severity: opts.severity,
        message: opts.message,
        updatedAt: new Date(),
      },
    });
    alertId = updated.id;
  } else {
    const history: HistoryEntry[] = [
      {
        at: new Date().toISOString(),
        action: "created",
        note: opts.message,
      },
    ];
    const created = await prisma.alert.create({
      data: {
        tenantId: opts.tenantId,
        type: opts.type,
        severity: opts.severity,
        message: opts.message,
        history: history as unknown as Prisma.InputJsonValue,
      },
    });
    alertId = created.id;
  }

  if (shouldNotifyAlert(opts.type, opts.severity)) {
    await notifyAlert(alertId);
  }
  return prisma.alert.findUniqueOrThrow({ where: { id: alertId } });
}

/** Belirli tipteki açık uyarıları sistem adına kapatır. */
export async function resolveOpenAlertsOfType(
  tenantId: string,
  type: string,
  note = "Koşul ortadan kalktı",
): Promise<number> {
  const open = await prisma.alert.findMany({
    where: { tenantId, type, resolved: false },
    select: { id: true },
  });
  for (const a of open) {
    await resolveAlert({ alertId: a.id, by: "system", note });
  }
  return open.length;
}

/**
 * Threshold evaluation using Google Ads + Meta spend (combined).
 * Low volume below minSpendForAlert does not create noise.
 */
export async function evaluateTenantAlerts(tenantId: string) {
  // Ay başı / ayın günü İstanbul takvimine göre (UTC'de 1'inin 00–03 arası önceki ay sayılıyordu).
  const todayYmd = istanbulYmd(new Date());
  const monthKey = todayYmd.slice(0, 7);
  const monthStart = ymdToUtcDate(startOfIstanbulMonthYmd(todayYmd));
  const dayOfMonth = Number(todayYmd.slice(8, 10));

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      thresholds: true,
      mapping: true,
      syncJobs: true,
      accountHealth: true,
      budgets: { where: { month: monthKey } },
      campaignBudgets: { where: { month: monthKey } },
      // Satır sayısı değil tarih: çok kampanyalı hesapta take:90 ay toplamını kesiyordu.
      googleAdsMetrics: { where: { date: { gte: monthStart } } },
      metaInsights: { where: { date: { gte: monthStart } } },
    },
  });
  if (!tenant) return;

  const thresholds = tenant.thresholds ?? {
    budgetPaceWarnPct: 85,
    convDropoutDays: 3,
    minSpendForAlert: 100 as unknown as { toString: () => string },
    cplTarget: null,
  };

  const minSpend = Number(
    typeof thresholds.minSpendForAlert === "object" &&
      thresholds.minSpendForAlert &&
      "toString" in thresholds.minSpendForAlert
      ? thresholds.minSpendForAlert.toString()
      : thresholds.minSpendForAlert,
  );
  const cplTarget =
    thresholds.cplTarget != null ? Number(thresholds.cplTarget) : null;

  const mtdGoogle = tenant.googleAdsMetrics;
  const mtdMeta = tenant.metaInsights;
  const mtdGoogleSpend = mtdGoogle.reduce((s, m) => s + Number(m.cost), 0);
  const mtdMetaSpend = mtdMeta.reduce((s, m) => s + Number(m.spend), 0);
  const mtdSpend = mtdGoogleSpend + mtdMetaSpend;
  const mtdConv =
    mtdGoogle.reduce((s, m) => s + Number(m.conversions), 0) +
    mtdMeta.reduce((s, m) => s + Number(m.conversions ?? 0), 0);

  // Kullanılmayan platformlar uyarı üretmez (marka detayı → Platformlar).
  const off = new Set(tenant.disabledIntegrations);
  const currency = tenant.currency;

  if (!off.has("google_ads") && !tenant.mapping?.adsCustomerId) {
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
  if (!off.has("google_ads") && adsJob?.status === "error") {
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
  if (!off.has("meta") && metaJob?.status === "error") {
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
  if (!off.has("ga4") && ga4Job?.status === "error") {
    await upsertOpenAlert({
      tenantId,
      type: "sync_error_ga4",
      severity: "unknown",
      message: `GA4 sync hatası: ${ga4Job.error || "bilinmeyen"}`,
    });
  }

  const dropoutDays = thresholds.convDropoutDays ?? 3;
  if (mtdSpend >= minSpend && mtdConv === 0 && dayOfMonth >= dropoutDays) {
    await upsertOpenAlert({
      tenantId,
      type: "conv_dropout",
      severity: "critical",
      message: `Harcama var, son dönemde dönüşüm 0 — ölçüm kesintisi şüphesi.`,
    });
  }

  // --- Token süresi doldu (Meta / Google) ---
  const liveJobs = withoutDisabledJobs(
    tenant.syncJobs.filter(
      (j) => !["panel_sync", "cron", "backfill"].includes(j.service),
    ),
    tenant.disabledIntegrations,
  );
  const tokenProviders = [
    ...new Set(
      liveJobs
        .filter((j) => j.status === "error" && classifySyncError(j.error) === "token")
        .map((j) => (j.provider === "meta" ? "Meta" : "Google")),
    ),
  ];
  if (tokenProviders.length) {
    await upsertOpenAlert({
      tenantId,
      type: "token_expired",
      severity: "critical",
      message: `${tokenProviders.join(" ve ")} API erişimi süresi doldu — yeniden yetkilendirme gerekli, veri çekilemiyor.`,
    });
  } else {
    await resolveOpenAlertsOfType(tenantId, "token_expired", "Erişim yenilendi");
  }

  // --- Plan: marka aylık / kanal payı / kampanya toplamı ---
  const budget = tenant.budgets[0];
  const campaignTotal = tenant.campaignBudgets.reduce(
    (s, c) => s + Number(c.monthlyBudget ?? 0),
    0,
  );
  const channelTotal =
    budget && (budget.googleBudget != null || budget.metaBudget != null)
      ? Number(budget.googleBudget ?? 0) + Number(budget.metaBudget ?? 0)
      : 0;
  const planned =
    budget?.monthlyBudget != null
      ? Number(budget.monthlyBudget)
      : channelTotal || campaignTotal || null;
  const channelPlanned = {
    google:
      budget?.googleBudget != null
        ? Number(budget.googleBudget)
        : tenant.campaignBudgets
            .filter((c) => c.provider === "google")
            .reduce((s, c) => s + Number(c.monthlyBudget ?? 0), 0),
    meta:
      budget?.metaBudget != null
        ? Number(budget.metaBudget)
        : tenant.campaignBudgets
            .filter((c) => c.provider === "meta")
            .reduce((s, c) => s + Number(c.monthlyBudget ?? 0), 0),
  };

  // --- Bütçe aşıldı ---
  if (planned != null && planned > 0 && mtdSpend >= planned) {
    await upsertOpenAlert({
      tenantId,
      type: "budget_over",
      severity: "critical",
      message: `Aylık bütçe aşıldı: ${money(mtdSpend, currency)} / plan ${money(planned, currency)}.`,
    });
  } else {
    await resolveOpenAlertsOfType(tenantId, "budget_over", "Harcama plan altında");
  }

  // --- CPL / CPA hedefi aşıldı ---
  if (cplTarget != null && cplTarget > 0 && mtdConv > 0 && mtdSpend >= minSpend) {
    const cpl = mtdSpend / mtdConv;
    if (cpl > cplTarget) {
      await upsertOpenAlert({
        tenantId,
        type: "cpl_over",
        severity: "warn",
        message: `${tenant.type === "ecommerce" ? "Satış" : "Lead"} maliyeti hedefin üstünde: ${money(cpl, currency)} > hedef ${money(cplTarget, currency)}.`,
      });
    } else {
      await resolveOpenAlertsOfType(tenantId, "cpl_over", "Maliyet hedefe döndü");
    }
  } else {
    await resolveOpenAlertsOfType(tenantId, "cpl_over", "Hedef / veri yok");
  }

  // --- Harcama durdu (kanal bazında) ---
  const [lastGoogle, lastMeta] = await Promise.all([
    prisma.googleAdsMetric.findFirst({
      where: { tenantId, cost: { gt: 0 } },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
    prisma.metaInsight.findFirst({
      where: { tenantId, spend: { gt: 0 } },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
  ]);
  for (const provider of ["google", "meta"] as const) {
    const type = `spend_stopped_${provider}`;
    const integration = provider === "google" ? "google_ads" : "meta";
    const label = provider === "google" ? "Google Ads" : "Meta";
    const last = provider === "google" ? lastGoogle : lastMeta;
    const job = provider === "google" ? adsJob : metaJob;
    const hasPlan =
      channelPlanned[provider] > 0 || (planned != null && planned > 0 && last != null);
    if (off.has(integration) || !hasPlan || !last || job?.status === "error") {
      await resolveOpenAlertsOfType(tenantId, type, "Koşul yok");
      continue;
    }
    const lastYmd = last.date.toISOString().slice(0, 10);
    const stoppedDays = Math.max(0, daysBetween(lastYmd, todayYmd) - 1);
    if (stoppedDays >= SPEND_STOP_DAYS) {
      const acc = tenant.accountHealth.find((a) => a.provider === provider);
      const raw = (acc?.raw ?? {}) as Record<string, unknown>;
      const active = raw.enabledCampaigns ?? raw.activeCampaigns;
      const cause =
        acc && (acc.status === "critical" || acc.status === "warn")
          ? acc.label
          : active === 0
            ? "Aktif kampanya yok"
            : null;
      await upsertOpenAlert({
        tenantId,
        type,
        severity: "critical",
        message: `${label}: ${stoppedDays} gündür harcama yok (son harcama ${dmy(lastYmd)})${cause ? ` — ${cause}` : ""}.`,
      });
    } else {
      await resolveOpenAlertsOfType(tenantId, type, "Harcama yeniden başladı");
    }
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
