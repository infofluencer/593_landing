import type { TenantType } from "@prisma/client";
import type {
  HealthStatus,
  MockCampaignMetric,
  MockTenantBundle,
} from "@/lib/panel/mock-data";
import { derivedMetrics, deltaPct } from "@/lib/panel/mock-data";

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

export type PresentationModel = {
  brand: string;
  tenantType: TenantType;
  typeLabel: string;
  currency: string;
  periodLabel: string;
  health: HealthStatus;
  totalSpend: number;
  totalConv: number;
  totalRevenue: number | null;
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
  if (provider === "google" && !bundle.tenant.mapping.adsCustomerId) {
    return {
      status: "unknown",
      note: "Google Ads eşleştirilmemiş.",
    };
  }
  if (provider === "meta" && !bundle.tenant.metaAccountId) {
    return {
      status: "unknown",
      note: "Meta hesap ID yok.",
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
  if (bundle.health === "critical" && provider === "meta") {
    return { status: "critical" };
  }
  if (bundle.health === "warn") return { status: "warn" };
  return { status: "ok" };
}

function buildChannel(
  id: ChannelId,
  bundle: MockTenantBundle,
  current: MockCampaignMetric,
  previous: MockCampaignMetric,
  campaigns: MockCampaignMetric[],
): ChannelView {
  const type = bundle.tenant.type;
  const d = derivedMetrics(current);
  const { status, note } = channelStatus(bundle, id);
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
    color: id === "meta" ? "#0668E1" : "#4285F4",
    status,
    statusNote: note,
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
    costPerResultLabel: ecommerce ? "CPA" : "CPL",
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

function buildDaily(
  gSpend: number,
  mSpend: number,
  gConv: number,
  mConv: number,
  gUnk: boolean,
  mUnk: boolean,
): DailyTrendPoint[] {
  const weights = [0.11, 0.13, 0.14, 0.15, 0.16, 0.17, 0.14];
  const labels = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  return labels.map((label, i) => {
    const w = weights[i]!;
    return {
      label,
      googleSpend: gUnk ? 0 : Math.round(gSpend * w),
      metaSpend: mUnk ? 0 : Math.round(mSpend * w),
      googleConv: gUnk ? 0 : Math.round(gConv * w * 10) / 10,
      metaConv: mUnk ? 0 : Math.round(mConv * w * 10) / 10,
    };
  });
}

const CONV_COLORS = {
  sale: "#34d399",
  form: "#60a5fa",
  whatsapp: "#a3e635",
  other: "#94a3b8",
};

export function buildPresentation(bundle: MockTenantBundle): PresentationModel {
  const type = bundle.tenant.type;
  const google = buildChannel(
    "google",
    bundle,
    bundle.current.account,
    bundle.previous.account,
    bundle.current.campaigns,
  );
  const meta = buildChannel(
    "meta",
    bundle,
    bundle.metaCurrent.account,
    bundle.metaPrevious.account,
    bundle.metaCurrent.campaigns,
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
      ? [{ name: "Meta", value: mSpend, color: "#0668E1" }]
      : []),
  ];

  const byKind = { sale: 0, form: 0, whatsapp: 0, other: 0 };
  for (const c of bundle.conversions) {
    byKind[c.kind] += c.count;
  }
  const conversionMix = (
    [
      { name: "Satış", value: byKind.sale, fill: CONV_COLORS.sale },
      { name: "Form / lead", value: byKind.form, fill: CONV_COLORS.form },
      { name: "WhatsApp", value: byKind.whatsapp, fill: CONV_COLORS.whatsapp },
      { name: "Diğer", value: byKind.other, fill: CONV_COLORS.other },
    ] as const
  ).filter((x) => x.value > 0);

  return {
    brand: bundle.tenant.name,
    tenantType: type,
    typeLabel: type === "ecommerce" ? "E-ticaret" : "Lead / form",
    currency: bundle.tenant.currency,
    periodLabel: `${bundle.current.from} → ${bundle.current.to}`,
    health: bundle.health,
    totalSpend: gSpend + mSpend,
    totalConv: gConv + mConv,
    totalRevenue: revenue,
    google,
    meta,
    daily: buildDaily(
      gSpend,
      mSpend,
      gConv,
      mConv,
      google.status === "unknown",
      meta.status === "unknown",
    ),
    mix,
    conversionMix: [...conversionMix],
  };
}

export const METRIC_HELP = {
  spend: "Reklama harcanan tutar",
  clicks: "Reklama tıklayan kişi sayısı",
  conv: "Hedeflenen sonuç (satış, form, WhatsApp…)",
  roas: "Her 1 TL harcamaya karşılık gelen ciro",
  cpa: "Bir satışın ortalama maliyeti",
  cpl: "Bir lead’in ortalama maliyeti",
  ctr: "Gösterim başına tıklama oranı",
  reach: "Reklamı gören tekil kişi sayısı",
} as const;
