import type { TenantType } from "@prisma/client";
import type {
  HealthStatus,
  MockCampaignMetric,
  MockTenantBundle,
} from "@/lib/panel/mock-data";
import { derivedMetrics, deltaPct } from "@/lib/panel/mock-data";
import { resolveAdsCustomerId } from "@/lib/panel/google-ads-customer-map";
import { resolveMetaAccountId } from "@/lib/panel/meta-ad-account-map";
import type { TenantStatus } from "@/lib/panel/status-reasons";
import type { MockMetaDailyPoint } from "@/lib/panel/mock-data";

export type ChannelId = "google" | "meta";

export type ChannelView = {
  id: ChannelId;
  label: string;
  short: string;
  /** Firma dilinde bölüm başlığı */
  sectionTitle: string;
  color: string;
  status: HealthStatus;
  statusNote?: string;
  /** Rozet sebepleri (müşteri dilinde). */
  reasons: string[];
  tenantType: TenantType;
  spend: number;
  clicks: number;
  impr: number;
  reach: number | null;
  frequency: number | null;
  conv: number;
  convValue: number | null;
  ctr: number;
  cpc: number;
  /** CPA (ecom) veya CPL (lead) */
  costPerResult: number | null;
  costPerResultLabel: string;
  roas: number | null;
  showRoas: boolean;
  showRevenue: boolean;
  prevSpend: number;
  prevConv: number;
  spendDelta: number | null;
  convDelta: number | null;
  campaigns: MockCampaignMetric[];
};

export type DailyTrendPoint = {
  label: string;
  googleSpend: number;
  metaSpend: number;
  googleConv: number;
  metaConv: number;
};

/** Gün / hafta / ay kovası — bu dönem ve önceki dönem aynı sırayla. */
export type SeriesPoint = {
  label: string;
  spend: number;
  conv: number;
  clicks: number;
  impr: number;
  reach: number;
  convValue: number;
};

export type PresentationModel = {
  brand: string;
  tenantType: TenantType;
  typeLabel: string;
  currency: string;
  periodLabel: string;
  health: HealthStatus;
  healthReasons: string[];
  totalSpend: number;
  totalConv: number;
  totalRevenue: number | null;
  totalClicks: number;
  totalImpr: number;
  totalReach: number | null;
  prev: { spend: number; conv: number; clicks: number; impr: number; revenue: number | null };
  /** Kanal toplamı (Google + Meta) — bu dönem ve önceki dönem, aynı kova sırası. */
  series: SeriesPoint[];
  prevSeries: SeriesPoint[];
  google: ChannelView;
  meta: ChannelView;
  daily: DailyTrendPoint[];
  mix: { name: string; value: number; color: string }[];
  conversionMix: { name: string; value: number; fill: string }[];
};

function channelStatus(
  bundle: MockTenantBundle,
  provider: "google" | "meta",
): { status: HealthStatus; note?: string } {
  const job = bundle.syncJobs.find((j) =>
    provider === "meta"
      ? j.provider === "meta" && j.service === "insights"
      : j.provider === "google" && j.service === "ads",
  );
  if (job?.status === "error") {
    return {
      status: "unknown",
      note: `${provider === "meta" ? "Meta" : "Google"} sync hatası — sıfır yazılmadı.`,
    };
  }
  if (
    provider === "google" &&
    !resolveAdsCustomerId({
      slug: bundle.tenant.slug,
      name: bundle.tenant.name,
      mapping: bundle.tenant.mapping,
    })
  ) {
    return {
      status: "unknown",
      note: "Google Ads customer ID map’te yok.",
    };
  }
  if (
    provider === "meta" &&
    !resolveMetaAccountId({
      slug: bundle.tenant.slug,
      name: bundle.tenant.name,
      metaAccountId: bundle.tenant.metaAccountId,
    })
  ) {
    return {
      status: "unknown",
      note: "Meta hesap ID map’te yok.",
    };
  }
  if (
    job?.status !== "success" &&
    (provider === "meta"
      ? bundle.metaCurrent.campaigns.length === 0
      : bundle.current.campaigns.length === 0)
  ) {
    return {
      status: "unknown",
      note: "Henüz başarılı sync yok — kontrol edilemedi.",
    };
  }
  // Kanal kendi verisiyle OK; ajans geneli warn (GTM vb.) bu kanalı sıfırlamaz.
  if (bundle.health === "critical" && provider === "meta") {
    return { status: "critical" };
  }
  return { status: "ok" };
}

function buildChannel(
  id: ChannelId,
  bundle: MockTenantBundle,
  current: MockCampaignMetric,
  previous: MockCampaignMetric,
  campaigns: MockCampaignMetric[],
  tenantStatus?: TenantStatus,
): ChannelView {
  const type = bundle.tenant.type;
  const d = derivedMetrics(current);
  const base = channelStatus(bundle, id);
  // Sebepli durum (ödeme, harcama durdu, CPL…) veri okunamıyorsa "unknown" kalır.
  const cs = tenantStatus?.[id];
  const status: HealthStatus =
    base.status === "unknown" ? "unknown" : (cs?.status ?? base.status);
  const note = base.note;
  const reasons = [
    ...(cs?.reasons.map((r) => r.text) ?? []),
    ...(base.note && !cs?.reasons.length ? [base.note] : []),
  ];
  const unknown = status === "unknown";
  const ecommerce = type === "ecommerce";

  const sectionTitle =
    id === "meta"
      ? ecommerce
        ? "Web Sitesi Alışveriş Reklamları"
        : "Web Sitesi Form/İletişim Reklamları"
      : ecommerce
        ? "Google Ads — alışveriş & arama"
        : "Google Ads — lead & arama";

  return {
    id,
    label: id === "meta" ? "Meta Ads" : "Google Ads",
    short: id === "meta" ? "Meta" : "Google",
    sectionTitle,
    // Google mavi · Meta mor — pasta/trend grafiklerinde ayırt edilsin
    color: id === "meta" ? "#7C3AED" : "#4285F4",
    status,
    statusNote: note,
    reasons,
    tenantType: type,
    spend: unknown ? 0 : current.spend,
    clicks: unknown ? 0 : current.clicks,
    impr: unknown ? 0 : current.impr,
    reach: unknown ? null : (current.reach ?? null),
    frequency: unknown ? null : (current.frequency ?? null),
    conv: unknown ? 0 : current.conv,
    convValue: unknown || !ecommerce ? null : current.convValue,
    ctr: unknown ? 0 : d.ctr,
    cpc: unknown ? 0 : d.cpc,
    costPerResult: unknown || current.conv <= 0 ? null : d.cpa,
    costPerResultLabel: ecommerce ? "Satış maliyeti" : "Lead maliyeti",
    roas: unknown || !ecommerce ? null : d.roas,
    showRoas: ecommerce,
    showRevenue: ecommerce,
    prevSpend: previous.spend,
    prevConv: previous.conv,
    spendDelta: unknown ? null : deltaPct(current.spend, previous.spend),
    convDelta: unknown ? null : deltaPct(current.conv, previous.conv),
    campaigns: unknown ? [] : campaigns,
  };
}

const TR_MONTHS = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

function dayLabel(ymd: string): string {
  return `${Number(ymd.slice(8, 10))} ${TR_MONTHS[Number(ymd.slice(5, 7)) - 1]}`;
}

/**
 * Gerçek günlük harcama / dönüşüm (bundle.dailySpend). Uzun dönemde
 * haftalık (≤ 120 gün) ya da aylık kovalara toplanır.
 */
function buildDaily(
  points: MockTenantBundle["dailySpend"],
  gUnk: boolean,
  mUnk: boolean,
): DailyTrendPoint[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return [];
  const span =
    (Date.parse(sorted[sorted.length - 1]!.date) - Date.parse(sorted[0]!.date)) /
      86_400_000 +
    1;
  const mode = span <= 31 ? "day" : span <= 120 ? "week" : "month";

  const buckets = new Map<string, DailyTrendPoint>();
  for (const p of sorted) {
    let key = p.date;
    let label = dayLabel(p.date);
    if (mode === "week") {
      const d = new Date(`${p.date}T00:00:00Z`);
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      key = monday.toISOString().slice(0, 10);
      label = `${dayLabel(key)} haftası`;
    } else if (mode === "month") {
      key = p.date.slice(0, 7);
      label = `${TR_MONTHS[Number(p.date.slice(5, 7)) - 1]} ${p.date.slice(2, 4)}`;
    }
    const prev = buckets.get(key) || {
      label,
      googleSpend: 0,
      metaSpend: 0,
      googleConv: 0,
      metaConv: 0,
    };
    if (!gUnk) {
      prev.googleSpend += p.google;
      prev.googleConv += p.googleConv ?? 0;
    }
    if (!mUnk) {
      prev.metaSpend += p.meta;
      prev.metaConv += p.metaConv ?? 0;
    }
    buckets.set(key, prev);
  }
  return [...buckets.values()].map((b) => ({
    ...b,
    googleSpend: Math.round(b.googleSpend),
    metaSpend: Math.round(b.metaSpend),
    googleConv: Math.round(b.googleConv * 10) / 10,
    metaConv: Math.round(b.metaConv * 10) / 10,
  }));
}

const CONV_COLORS = {
  sale: "#34d399",
  form: "#60a5fa",
  whatsapp: "#a3e635",
  other: "#94a3b8",
};

/** Kanal günlüklerini (Google + Meta) aynı tarihte toplar. */
function mergeDaily(
  google: MockMetaDailyPoint[],
  meta: MockMetaDailyPoint[],
): Array<MockMetaDailyPoint & { date: string }> {
  const map = new Map<string, MockMetaDailyPoint>();
  for (const p of [...google, ...meta]) {
    const prev = map.get(p.date) ?? {
      date: p.date,
      spend: 0,
      clicks: 0,
      conv: 0,
      convValue: 0,
      impr: 0,
      reach: 0,
    };
    prev.spend += p.spend;
    prev.clicks += p.clicks;
    prev.conv += p.conv;
    prev.convValue += p.convValue;
    prev.impr = (prev.impr ?? 0) + (p.impr ?? 0);
    prev.reach = (prev.reach ?? 0) + (p.reach ?? 0);
    map.set(p.date, prev);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Dönem aralığını gün / hafta / ay kovalarına böler; boş günler 0 ile dolar
 * ki önceki dönemle aynı sırada hizalansın.
 */
export function bucketSeries(
  points: MockMetaDailyPoint[],
  from: string,
  to: string,
): SeriesPoint[] {
  const span =
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
  const mode = span <= 31 ? "day" : span <= 120 ? "week" : "month";
  const byDate = new Map(points.map((p) => [p.date, p]));
  const buckets = new Map<string, SeriesPoint>();
  for (let i = 0; i < span; i++) {
    const date = new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000)
      .toISOString()
      .slice(0, 10);
    let key = date;
    let label = dayLabel(date);
    if (mode === "week") {
      const d = new Date(`${date}T00:00:00Z`);
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      key = monday.toISOString().slice(0, 10);
      label = `${dayLabel(key)} haftası`;
    } else if (mode === "month") {
      key = date.slice(0, 7);
      label = `${TR_MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(2, 4)}`;
    }
    const b = buckets.get(key) ?? {
      label,
      spend: 0,
      conv: 0,
      clicks: 0,
      impr: 0,
      reach: 0,
      convValue: 0,
    };
    const p = byDate.get(date);
    if (p) {
      b.spend += p.spend;
      b.conv += p.conv;
      b.clicks += p.clicks;
      b.impr += p.impr ?? 0;
      b.reach += p.reach ?? 0;
      b.convValue += p.convValue;
    }
    buckets.set(key, b);
  }
  return [...buckets.values()].map((b) => ({
    ...b,
    spend: Math.round(b.spend),
    conv: Math.round(b.conv * 10) / 10,
    convValue: Math.round(b.convValue),
  }));
}

export function buildPresentation(
  bundle: MockTenantBundle,
  periodLabelOverride?: string,
  tenantStatus?: TenantStatus,
): PresentationModel {
  const type = bundle.tenant.type;
  const google = buildChannel(
    "google",
    bundle,
    bundle.current.account,
    bundle.previous.account,
    bundle.current.campaigns,
    tenantStatus,
  );
  const meta = buildChannel(
    "meta",
    bundle,
    bundle.metaCurrent.account,
    bundle.metaPrevious.account,
    bundle.metaCurrent.campaigns,
    tenantStatus,
  );
  const gUnk = google.status === "unknown";
  const mUnk = meta.status === "unknown";
  const series = bucketSeries(
    mergeDaily(gUnk ? [] : (bundle.googleDaily ?? []), mUnk ? [] : bundle.metaDaily),
    bundle.current.from,
    bundle.current.to,
  );
  const prevSeries = bucketSeries(
    mergeDaily(
      gUnk ? [] : (bundle.prevDaily?.google ?? []),
      mUnk ? [] : (bundle.prevDaily?.meta ?? []),
    ),
    bundle.previous.from,
    bundle.previous.to,
  );

  const gSpend = google.status === "unknown" ? 0 : google.spend;
  const mSpend = meta.status === "unknown" ? 0 : meta.spend;
  const gConv = google.status === "unknown" ? 0 : google.conv;
  const mConv = meta.status === "unknown" ? 0 : meta.conv;

  const revenue =
    type === "ecommerce"
      ? (google.convValue ?? 0) + (meta.convValue ?? 0)
      : null;

  const mix = [
    ...(google.status !== "unknown" && gSpend > 0
      ? [{ name: "Google", value: gSpend, color: "#4285F4" }]
      : []),
    ...(meta.status !== "unknown" && mSpend > 0
      ? [{ name: "Meta", value: mSpend, color: "#7C3AED" }]
      : []),
  ];

  const byKind = { sale: 0, form: 0, whatsapp: 0, other: 0 };
  for (const c of bundle.conversions) {
    // KPI ile aynı küme: yalnızca sayılan (primary) ve olası mükerrer olmayanlar.
    if (!c.primary || c.dupeFlag) continue;
    if (type === "ecommerce" && c.kind !== "sale") continue;
    byKind[c.kind] += c.count;
  }
  const conversionMix = (
    type === "ecommerce"
      ? ([
          {
            name: "Satın alım ücreti",
            value: byKind.sale,
            fill: CONV_COLORS.sale,
          },
        ] as const)
      : ([
          { name: "Satış", value: byKind.sale, fill: CONV_COLORS.sale },
          { name: "Form / lead", value: byKind.form, fill: CONV_COLORS.form },
          {
            name: "WhatsApp",
            value: byKind.whatsapp,
            fill: CONV_COLORS.whatsapp,
          },
          { name: "Diğer", value: byKind.other, fill: CONV_COLORS.other },
        ] as const)
  ).filter((x) => x.value > 0);

  return {
    brand: bundle.tenant.name,
    tenantType: type,
    typeLabel: type === "ecommerce" ? "E-ticaret" : "Lead / form",
    currency: bundle.tenant.currency,
    periodLabel:
      periodLabelOverride ??
      `${bundle.current.from} → ${bundle.current.to}`,
    health: tenantStatus?.overall.status ?? bundle.health,
    healthReasons: tenantStatus?.overall.reasons.map((r) => r.text) ?? [],
    totalSpend: gSpend + mSpend,
    totalConv: gConv + mConv,
    totalRevenue: revenue,
    totalClicks: (gUnk ? 0 : google.clicks) + (mUnk ? 0 : meta.clicks),
    totalImpr: (gUnk ? 0 : google.impr) + (mUnk ? 0 : meta.impr),
    totalReach: mUnk ? null : meta.reach,
    prev: {
      spend: (gUnk ? 0 : bundle.previous.account.spend) + (mUnk ? 0 : bundle.metaPrevious.account.spend),
      conv: (gUnk ? 0 : bundle.previous.account.conv) + (mUnk ? 0 : bundle.metaPrevious.account.conv),
      clicks: (gUnk ? 0 : bundle.previous.account.clicks) + (mUnk ? 0 : bundle.metaPrevious.account.clicks),
      impr: (gUnk ? 0 : bundle.previous.account.impr) + (mUnk ? 0 : bundle.metaPrevious.account.impr),
      revenue:
        type === "ecommerce"
          ? (gUnk ? 0 : bundle.previous.account.convValue) + (mUnk ? 0 : bundle.metaPrevious.account.convValue)
          : null,
    },
    series,
    prevSeries,
    google,
    meta,
    daily: buildDaily(
      bundle.dailySpend,
      google.status === "unknown",
      meta.status === "unknown",
    ),
    mix,
    conversionMix: [...conversionMix],
  };
}

/** @deprecated Prefer getMetricDescription / METRIC_DESCRIPTIONS */
export const METRIC_HELP = {
  spend: "Reklama harcanan tutar",
  clicks: "Reklama tıklayan kişi sayısı",
  conv: "E-ticarette yalnızca satın alım; lead’de Meta mesajlaşma + Google mesaj / form / lead",
  roas: "Her 1 TL harcamaya karşılık gelen ciro",
  cpa: "Bir satışın ortalama maliyeti",
  cpl: "Bir lead’in ortalama maliyeti",
  ctr: "Kaç gösterimde bir tıklama geldiği",
  reach: "Reklamı gören tekil kişi sayısı",
  impr: "Reklamın kaç kez gösterildiği",
} as const;

/** Kanal marka renkleri — sunum pasta/trend + sayfa grafikleri. */
export const CHANNEL_BRAND = {
  google: "#4285F4",
  meta: "#7C3AED",
} as const;
