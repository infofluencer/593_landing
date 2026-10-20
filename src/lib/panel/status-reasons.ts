/**
 * Firma paneli durum rozetlerinin sebebi — müşteri dilinde, kısa.
 * "Uyarı" / "Kritik" tek başına bir şey anlatmaz; rozetin üstüne gelince
 * "Google Ads 12 gündür harcama yok — Aktif kampanya yok" gibi görünür.
 *
 * Saf hesap: bundle + (varsa) bütçe planı özeti. Prisma import etmez.
 */
import type {
  HealthStatus,
  MockAccountHealth,
  MockTenantBundle,
} from "@/lib/panel/mock-data";
import {
  PACE_STATUS_META,
  computeBudgetPacing,
  type BudgetPaceStatus,
} from "@/lib/panel/budget-pacing";
import { classifySyncError } from "@/lib/panel/sync-error-class";
import { formatTry } from "@/lib/panel/format";

export type ReasonTone = "critical" | "warn" | "unknown";

export type StatusReason = { tone: ReasonTone; text: string };

export type ChannelStatus = {
  status: HealthStatus;
  reasons: StatusReason[];
};

export type TenantStatus = {
  overall: ChannelStatus;
  google: ChannelStatus;
  meta: ChannelStatus;
  ga4: ChannelStatus;
  gtm: ChannelStatus;
  budget: ChannelStatus & { pace: BudgetPaceStatus | null };
};

/** Sayfaların verdiği plan özeti (summarizeBudgetPlan + pace aralığı). */
export type StatusPlanInput = {
  planned: number | null;
  google: number | null;
  meta: number | null;
  spent: number;
  todaySpend: number;
  from: string;
  to: string;
};

/** Üst üste iki gün harcama yoksa "harcama durdu". */
export const SPEND_STOP_DAYS = 2;

const LABEL = { google: "Google Ads", meta: "Meta" } as const;

function daysBetween(fromYmd: string, toYmd: string): number {
  const ms = (ymd: string) =>
    Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));
  return Math.round((ms(toYmd) - ms(fromYmd)) / 86_400_000);
}

function dmy(ymd: string): string {
  return `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}`;
}

function worst(reasons: StatusReason[], fallback: HealthStatus = "ok"): HealthStatus {
  if (reasons.some((r) => r.tone === "critical")) return "critical";
  if (reasons.some((r) => r.tone === "warn")) return "warn";
  if (reasons.some((r) => r.tone === "unknown")) return "unknown";
  return fallback;
}

/** Aynı metin iki kaynaktan gelebilir. */
function dedupe(reasons: StatusReason[]): StatusReason[] {
  const seen = new Set<string>();
  const rank: Record<ReasonTone, number> = { critical: 0, warn: 1, unknown: 2 };
  return reasons
    .filter((r) => (seen.has(r.text) ? false : (seen.add(r.text), true)))
    .sort((a, b) => rank[a.tone] - rank[b.tone]);
}

/** Reklam hesabı durumundan "neden harcama yok" sebebi. */
function noSpendCause(acc: MockAccountHealth | null | undefined): string | null {
  if (!acc) return null;
  if (acc.status === "critical" || acc.status === "warn") return acc.label;
  if (acc.activeCampaigns === 0) return "Aktif kampanya yok";
  return null;
}

function channelStatus(
  bundle: MockTenantBundle,
  provider: "google" | "meta",
  opts: { today: string; plan: StatusPlanInput | null },
): ChannelStatus {
  const off = new Set(bundle.tenant.disabledIntegrations ?? []);
  if (off.has(provider === "google" ? "google_ads" : "meta")) {
    return { status: "ok", reasons: [] };
  }
  const label = LABEL[provider];
  const reasons: StatusReason[] = [];
  const acc = bundle.accounts?.[provider] ?? null;

  if (acc && (acc.status === "critical" || acc.status === "warn")) {
    reasons.push({
      tone: acc.status,
      text: `${label}: ${acc.label}${acc.detail ? ` — ${acc.detail}` : ""}`,
    });
  }

  const job = bundle.syncJobs.find((j) =>
    provider === "meta"
      ? j.provider === "meta" && j.service === "insights"
      : j.provider === "google" && j.service === "ads",
  );
  const mapped =
    provider === "google"
      ? Boolean(bundle.tenant.mapping?.adsCustomerId)
      : Boolean(bundle.tenant.metaAccountId);
  if (job?.status === "error") {
    const cls = classifySyncError(job.error);
    reasons.push({
      tone: "unknown",
      text:
        cls === "token"
          ? `${label} bağlantısı yenilenmeli — erişim süresi doldu`
          : cls === "permission"
            ? `${label} hesabına erişim yok`
            : cls === "setup"
              ? `${label} hesabı eşleştirilmemiş`
              : `${label} verisi güncellenemedi`,
    });
  } else if (!mapped) {
    reasons.push({ tone: "unknown", text: `${label} hesabı bağlı değil` });
  }

  const unknownData = reasons.some((r) => r.tone === "unknown");
  const spend =
    provider === "google"
      ? bundle.current.account.spend
      : bundle.metaCurrent.account.spend;
  const conv =
    provider === "google"
      ? bundle.current.account.conv
      : bundle.metaCurrent.account.conv;
  const lastSpend = bundle.lastSpend?.[provider] ?? null;
  const stoppedDays = lastSpend
    ? Math.max(0, daysBetween(lastSpend, opts.today) - 1)
    : null;
  const channelPlanned = opts.plan?.[provider] ?? null;
  const planned =
    channelPlanned != null && channelPlanned > 0
      ? channelPlanned
      : opts.plan?.planned != null && opts.plan.planned > 0 && lastSpend
        ? opts.plan.planned
        : null;

  if (!unknownData) {
    const stopped = stoppedDays != null && stoppedDays >= SPEND_STOP_DAYS;
    if (planned != null && (spend === 0 || stopped)) {
      const cause = noSpendCause(acc);
      const since =
        stoppedDays != null && stoppedDays >= 1
          ? `${stoppedDays} gündür harcama yok`
          : lastSpend
            ? "bugün harcama yok"
            : "hiç harcama yok";
      const tail = cause
        ? ` — ${cause}`
        : lastSpend
          ? ` (son harcama ${dmy(lastSpend)})`
          : "";
      reasons.push({ tone: "critical", text: `${label}: ${since}${tail}` });
    } else if (stopped && planned == null) {
      reasons.push({
        tone: "warn",
        text: `${label}: ${stoppedDays} gündür harcama yok`,
      });
    }

    const target = bundle.thresholds.cplTarget ?? null;
    if (target != null && target > 0 && conv > 0 && spend / conv > target) {
      const ecommerce = bundle.tenant.type === "ecommerce";
      reasons.push({
        tone: "warn",
        text: `${label}: ${ecommerce ? "satış" : "lead"} maliyeti hedefin üstünde (${formatTry(spend / conv, bundle.tenant.currency)} > ${formatTry(target, bundle.tenant.currency)})`,
      });
    }
  }

  return { status: worst(dedupe(reasons)), reasons: dedupe(reasons) };
}

function ga4Status(bundle: MockTenantBundle): ChannelStatus {
  const off = new Set(bundle.tenant.disabledIntegrations ?? []);
  if (off.has("ga4")) return { status: "ok", reasons: [] };
  const reasons: StatusReason[] = [];
  const job = bundle.syncJobs.find(
    (j) => j.provider === "google" && j.service === "ga4",
  );
  if (job?.status === "error") {
    const cls = classifySyncError(job.error);
    reasons.push({
      tone: "unknown",
      text:
        cls === "token"
          ? "GA4 bağlantısı yenilenmeli — erişim süresi doldu"
          : cls === "setup"
            ? "GA4 mülkü eşleştirilmemiş"
            : "GA4 verisi güncellenemedi",
    });
  } else if (!bundle.tenant.mapping?.ga4PropertyId) {
    reasons.push({ tone: "unknown", text: "GA4 mülkü bağlı değil" });
  }
  return { status: worst(reasons), reasons };
}

function gtmStatus(bundle: MockTenantBundle): ChannelStatus {
  const off = new Set(bundle.tenant.disabledIntegrations ?? []);
  if (off.has("gtm")) return { status: "ok", reasons: [] };
  const reasons: StatusReason[] = [];
  const job = bundle.syncJobs.find(
    (j) => j.provider === "google" && j.service === "gtm",
  );
  if (job?.status === "error") {
    const cls = classifySyncError(job.error);
    reasons.push({
      tone: cls === "rate" ? "warn" : "unknown",
      text:
        cls === "rate"
          ? "GTM yapılandırması geçici olarak okunamıyor (API limiti)"
          : "GTM yapılandırması okunamadı",
    });
  } else if (!bundle.tenant.mapping?.gtmContainerId) {
    reasons.push({ tone: "unknown", text: "GTM konteyneri bağlı değil" });
  }
  return { status: worst(reasons), reasons };
}

/**
 * Tüm sayfaların kullandığı durum seti. `today` İstanbul YMD; `plan`
 * yoksa harcama-durdu kuralı yalnızca geçmişte harcaması olan kanalda uyarır.
 */
export function computeTenantStatus(
  bundle: MockTenantBundle,
  opts: { today: string; plan?: StatusPlanInput | null },
): TenantStatus {
  const plan = opts.plan ?? null;
  const google = channelStatus(bundle, "google", { today: opts.today, plan });
  const meta = channelStatus(bundle, "meta", { today: opts.today, plan });
  const ga4 = ga4Status(bundle);
  const gtm = gtmStatus(bundle);

  // Bütçe: tempo + harcamayı durduran kanal sebebi (asıl neden).
  const budgetReasons: StatusReason[] = [];
  let pace: BudgetPaceStatus | null = null;
  if (plan && plan.planned != null && plan.planned > 0) {
    const pacing = computeBudgetPacing({
      planned: plan.planned,
      spent: plan.spent,
      from: plan.from,
      to: plan.to,
      today: opts.today,
      todaySpend: plan.todaySpend,
    });
    pace = pacing.status;
    const meta_ = PACE_STATUS_META[pacing.status];
    if (meta_.tone === "warn" || meta_.tone === "critical") {
      budgetReasons.push({ tone: meta_.tone, text: `${meta_.label} — ${meta_.hint}` });
    }
  }
  for (const r of [...google.reasons, ...meta.reasons]) {
    if (r.tone === "critical") budgetReasons.push(r);
  }

  const overallReasons: StatusReason[] = [
    ...google.reasons,
    ...meta.reasons,
    ...ga4.reasons,
    ...gtm.reasons,
    ...budgetReasons,
  ];
  for (const a of bundle.alerts) {
    if (a.resolved) continue;
    if (a.type === "conv_dropout") {
      overallReasons.push({
        tone: "warn",
        text: "Harcama var ama dönüşüm gelmiyor — dönüşüm takibi kontrol edilmeli",
      });
    }
  }
  const overall = dedupe(overallReasons);
  // Her iki reklam kanalı da okunamıyorsa genel durum "kontrol edilemedi".
  const bothUnknown = google.status === "unknown" && meta.status === "unknown";
  const overallStatus = bothUnknown && !overall.some((r) => r.tone === "critical")
    ? "unknown"
    : worst(overall);

  return {
    overall: { status: overallStatus, reasons: overall },
    google,
    meta,
    ga4,
    gtm,
    budget: {
      status: worst(dedupe(budgetReasons)),
      reasons: dedupe(budgetReasons),
      pace,
    },
  };
}

/** Rozet için düz metin listesi. */
export function reasonTexts(s: ChannelStatus | null | undefined): string[] {
  return s ? s.reasons.map((r) => r.text) : [];
}
