import type { AlertSeverity, ConversionKind, Role, TenantType } from "@prisma/client";
import { cache } from "react";
import { getTenantBySlug, prisma, TenantAccessError } from "@/lib/db";
import { useMockPanelData } from "@/lib/integrations/tokens";
import { deriveMetaKpis } from "@/lib/integrations/meta/insights";
import {
  deriveMetaFunnel,
  deriveMetaLeadParts,
  deriveMetaPurchase,
  deriveMetaVideo,
  sumMetaFunnel,
  sumMetaVideo,
} from "@/lib/integrations/meta/metrics";
import {
  istanbulYmd,
  previousRangeYmd,
  startOfIstanbulMonthYmd,
  ymdToUtcDate,
} from "@/lib/date/tr";
import {
  EMPTY_META_FUNNEL,
  EMPTY_META_VIDEO,
  getMockBundleBySlug,
  countMockBundlesByVisible,
  listMockBundlesByVisible,
  listVisibleMockBundles,
  type HealthStatus,
  type MockCampaignMetric,
  type MockConversion,
  type MockDailySpendPoint,
  type MockGa4Overview,
  type MockGtmSnapshot,
  type MockMetaAdPerformance,
  type MockMetaAdsetPerformance,
  type MockMetaBreakdownRow,
  type MockMetaDailyPoint,
  type MockTenantBundle,
} from "@/lib/panel/mock-data";
import { resolveGa4PropertyId } from "@/lib/panel/ga4-property-map";
import { resolveGtmPublicId } from "@/lib/panel/gtm-container-map";

export { TenantAccessError };

export type BundleRangeOpts = {
  from: string;
  to: string;
};

const EMPTY_ACCOUNT: MockCampaignMetric = {
  campaign: "Hesap toplamı",
  spend: 0,
  impr: 0,
  clicks: 0,
  conv: 0,
  convValue: 0,
};

const EMPTY_GA4: MockGa4Overview = {
  totalUsers: 0,
  sessions: 0,
  averageSessionDuration: 0,
  bounceRate: 0,
  screenPageViewsPerSession: 0,
  sessionConversionRate: 0,
  purchaseRevenue: null,
  transactions: null,
};

const EMPTY_GTM: MockGtmSnapshot = {
  publicId: "",
  liveVersion: "—",
  unpublishedChanges: false,
  tags: [],
  triggers: 0,
  variables: 0,
  siteVerified: "not_tested",
};

function asActionMap(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const n = Number(val);
    if (!Number.isNaN(n)) out[k] = n;
  }
  return out;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sumCampaigns(
  campaigns: MockCampaignMetric[],
  label = "Hesap toplamı",
): MockCampaignMetric {
  const hasReach = campaigns.some((c) => c.reach != null);
  return campaigns.reduce(
    (acc, c) => ({
      campaign: label,
      spend: acc.spend + c.spend,
      impr: acc.impr + c.impr,
      clicks: acc.clicks + c.clicks,
      conv: acc.conv + c.conv,
      convValue: acc.convValue + c.convValue,
      allConv:
        c.allConv != null ? (acc.allConv ?? 0) + c.allConv : acc.allConv,
      reach: hasReach ? (acc.reach ?? 0) + (c.reach ?? 0) : undefined,
      frequency: undefined,
    }),
    { ...EMPTY_ACCOUNT, campaign: label },
  );
}

/**
 * Meta dönüşümü okuma anında actions'tan yeniden hesapla — kural değişince
 * (örn. lead çift sayımı düzeltmesi) tam sync beklemeden geçmiş de düzelir.
 */
function metaConv(
  type: TenantType,
  row: { actions?: unknown; actionValues?: unknown; conversions: unknown; convValue: unknown; spend: unknown },
): { conv: number; convValue: number } {
  if (row.actions === undefined) {
    return {
      conv: Number(row.conversions ?? 0),
      convValue: Number(row.convValue ?? 0),
    };
  }
  const k = deriveMetaKpis(
    type,
    asActionMap(row.actions),
    asActionMap(row.actionValues),
    Number(row.spend),
  );
  return { conv: k.conversions, convValue: k.convValue };
}

/**
 * Meta tıklama = bağlantı tıklaması (actions.link_click), Ads Manager'daki
 * "CTR (bağlantı)" ile aynı. "clicks" profil/beğeni/genişletme dahil tüm tıklamalar.
 */
function metaLinkClicks(row: { actions?: unknown; clicks: number }): number {
  if (row.actions === undefined) return row.clicks;
  const link = asActionMap(row.actions).link_click;
  return link != null ? link : row.clicks;
}

type GoogleMetricRow = {
  date: Date;
  campaignId: string;
  campaignName: string;
  cost: unknown;
  impressions: number;
  clicks: number;
  conversions: unknown;
  convValue: unknown;
  allConversions?: unknown;
};

type MetaInsightLite = {
  actions?: unknown;
  actionValues?: unknown;
  date: Date;
  campaignId: string;
  campaignName: string;
  objective: string;
  spend: unknown;
  impressions: number;
  clicks: number;
  reach: number;
  conversions: unknown;
  convValue: unknown;
};

/**
 * Kampanya ID'sine göre topla (ad değişince bölünmesin, aynı adlı iki kampanya
 * birleşmesin). Görünen ad: en son tarihli satırın adı.
 */
function groupGoogleCampaigns(rows: GoogleMetricRow[]): MockCampaignMetric[] {
  const byId = new Map<string, MockCampaignMetric>();
  const lastSeen = new Map<string, number>();
  for (const m of rows) {
    const id = m.campaignId || m.campaignName || "Google Ads";
    const t = m.date.getTime();
    const prev = byId.get(id) || {
      campaign: m.campaignName || "Google Ads",
      campaignId: id,
      spend: 0,
      impr: 0,
      clicks: 0,
      conv: 0,
      convValue: 0,
    };
    if (t >= (lastSeen.get(id) ?? 0) && m.campaignName) {
      prev.campaign = m.campaignName;
      lastSeen.set(id, t);
    }
    prev.spend += Number(m.cost);
    prev.impr += m.impressions;
    prev.clicks += m.clicks;
    prev.conv += Number(m.conversions);
    prev.convValue += Number(m.convValue);
    prev.allConv = (prev.allConv ?? 0) + Number(m.allConversions ?? 0);
    byId.set(id, prev);
  }
  return [...byId.values()];
}

function groupMetaCampaigns(
  type: TenantType,
  rows: MetaInsightLite[],
): MockCampaignMetric[] {
  const byId = new Map<string, MockCampaignMetric>();
  const lastSeen = new Map<string, number>();
  for (const m of rows) {
    const id = m.campaignId || m.campaignName || "Meta Ads";
    const t = m.date.getTime();
    const prev = byId.get(id) || {
      campaign: m.campaignName || "Meta Ads",
      campaignId: id,
      spend: 0,
      impr: 0,
      clicks: 0,
      conv: 0,
      convValue: 0,
      // Erişim günlerden toplanamaz (aynı kişi her gün sayılır) — dönem tekil
      // erişimi canlı çekilir: withMetaPeriodReach.
    };
    if (t >= (lastSeen.get(id) ?? 0) && m.campaignName) {
      prev.campaign = m.campaignName;
      lastSeen.set(id, t);
    }
    const c = metaConv(type, m);
    prev.spend += Number(m.spend);
    prev.impr += m.impressions;
    prev.clicks += metaLinkClicks(m);
    prev.conv += c.conv;
    prev.convValue += c.convValue;
    byId.set(id, prev);
  }
  return [...byId.values()];
}

/** Meta dönüşüm türleri — seçili dönemin MetaInsight.actions'ından. */
function metaConversionKinds(
  type: TenantType,
  rows: { actions: unknown; actionValues: unknown }[],
): MockConversion[] {
  let purchase = 0;
  let form = 0;
  let messaging = 0;
  for (const r of rows) {
    const actions = asActionMap(r.actions);
    if (type === "ecommerce") {
      purchase += deriveMetaPurchase(actions, asActionMap(r.actionValues)).count;
    } else {
      const parts = deriveMetaLeadParts(actions);
      form += parts.form;
      messaging += parts.messaging;
    }
  }
  const out: MockConversion[] = [];
  const add = (name: string, kind: ConversionKind, count: number) => {
    if (count > 0) {
      out.push({
        name,
        source: "Meta Ads",
        primary: true,
        count,
        kind,
        dupeFlag: false,
      });
    }
  };
  add("Meta satın alım", "sale", purchase);
  add("Meta form lead", "form", form);
  add("Meta mesajlaşma (WhatsApp/Messenger)", "whatsapp", messaging);
  return out;
}

/** Google dönüşüm aksiyonu günlük satırları → dönem toplamı (ad başına). */
function groupGoogleConversions(
  rows: {
    name: string;
    source: string;
    primary: boolean;
    count: unknown;
    kind: ConversionKind;
    dupeFlag: boolean;
  }[],
): MockConversion[] {
  const byName = new Map<string, MockConversion>();
  for (const c of rows) {
    const key = `${c.source}|${c.name}`;
    const prev = byName.get(key) || {
      name: c.name,
      source: c.source,
      primary: c.primary,
      count: 0,
      kind: c.kind,
      dupeFlag: c.dupeFlag,
    };
    prev.count += Number(c.count);
    prev.primary = prev.primary || c.primary;
    prev.dupeFlag = prev.dupeFlag || c.dupeFlag;
    byName.set(key, prev);
  }
  return [...byName.values()]
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
}

export const resolvePanelTenant = cache(async function resolvePanelTenant(
  slug: string,
) {
  const dbTenant = await getTenantBySlug(slug);
  const mock = useMockPanelData() ? getMockBundleBySlug(slug) : undefined;

  if (!dbTenant && !mock) return null;

  const mappingRow = dbTenant
    ? await prisma.tenantMapping.findUnique({ where: { tenantId: dbTenant.id } })
    : null;

  const id = dbTenant?.id ?? mock!.tenant.id;
  const name = dbTenant?.name ?? mock!.tenant.name;
  const type: TenantType = dbTenant?.type ?? mock!.tenant.type;
  const currency = dbTenant?.currency ?? mock!.tenant.currency;
  const website = dbTenant?.website ?? mock?.tenant.website ?? null;
  const timezone =
    dbTenant?.timezone ?? mock?.tenant.timezone ?? "Europe/Istanbul";
  const mapping = mappingRow
    ? {
        adsCustomerId: mappingRow.adsCustomerId,
        ga4PropertyId: mappingRow.ga4PropertyId,
        gtmContainerId: mappingRow.gtmContainerId,
        gscSiteUrl: mappingRow.gscSiteUrl,
        merchantId: mappingRow.merchantId,
      }
    : (mock?.tenant.mapping ?? {
        adsCustomerId: null,
        ga4PropertyId: null,
        gtmContainerId: null,
        gscSiteUrl: null,
        merchantId: null,
      });

  return {
    id,
    slug,
    name,
    type,
    website,
    currency,
    timezone,
    mapping,
    bundle: mock ?? null,
  };
});

function healthFromJobs(
  jobs: { service: string; status: string; error: string | null }[],
  openAlerts: { severity: AlertSeverity }[],
): HealthStatus {
  if (openAlerts.some((a) => a.severity === "critical")) return "critical";

  // Geriye dönük doldurma kaydı marka sağlığını etkilemez.
  jobs = jobs.filter((j) => j.service !== "backfill");

  const hasSuccess = jobs.some((j) => j.status === "success");
  const hasError = jobs.some((j) => j.status === "error");

  // Kısmi sync (örn. Ads OK, GTM hata) → warn; hepsi hata/yok → unknown
  if (hasError && hasSuccess) return "warn";
  if (hasError && !hasSuccess) return "unknown";
  if (openAlerts.some((a) => a.severity === "warn" || a.severity === "unknown"))
    return "warn";
  if (hasSuccess) return "ok";
  return "unknown";
}

async function bundleFromDb(
  slug: string,
  range: BundleRangeOpts,
): Promise<MockTenantBundle | null> {
  const fromDate = ymdToUtcDate(range.from);
  const toDate = ymdToUtcDate(range.to);
  const dateFilter = { gte: fromDate, lte: toDate };
  const prevRange = previousRangeYmd(range.from, range.to);
  const prevDateFilter = {
    gte: ymdToUtcDate(prevRange.from),
    lte: ymdToUtcDate(prevRange.to),
  };

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: {
      mapping: true,
      thresholds: true,
      syncJobs: true,
      alerts: {
        where: { resolved: false },
        orderBy: { updatedAt: "desc" },
        include: { assignee: { select: { email: true } } },
      },
      siteVerification: true,
      googleAdsMetrics: {
        where: { date: dateFilter },
      },
      metaInsights: {
        where: { date: dateFilter },
      },
      metaAds: true,
      metaAdInsights: {
        where: { date: dateFilter },
      },
      metaAdsetInsights: {
        where: { date: dateFilter },
      },
      metaBreakdowns: {
        where: { date: dateFilter },
      },
      // GA4 günlük satırlar (genel bakış + kanal) — canlı çekim başarısızsa yedek.
      ga4Metrics: {
        where: {
          date: dateFilter,
          dimensionType: { in: ["overview", "channel"] },
        },
      },
      conversions: {
        where: { date: dateFilter },
      },
    },
  });
  if (!tenant) return null;

  // Önceki dönem (aynı uzunluk, hemen önce) — delta rozetleri için.
  const [prevGoogleRows, prevMetaRows] = await Promise.all([
    prisma.googleAdsMetric.findMany({
      where: { tenantId: tenant.id, date: prevDateFilter },
    }),
    prisma.metaInsight.findMany({
      where: { tenantId: tenant.id, date: prevDateFilter },
      select: {
        date: true,
        campaignId: true,
        campaignName: true,
        objective: true,
        spend: true,
        impressions: true,
        clicks: true,
        reach: true,
        conversions: true,
        convValue: true,
        actions: true,
        actionValues: true,
      },
    }),
  ]);
  const ga4Rows = tenant.ga4Metrics;

  const adsJob = tenant.syncJobs.find(
    (j) => j.provider === "google" && j.service === "ads",
  );
  const metaJob = tenant.syncJobs.find(
    (j) => j.provider === "meta" && j.service === "insights",
  );
  const ga4Job = tenant.syncJobs.find(
    (j) => j.provider === "google" && j.service === "ga4",
  );

  // Metrik varsa göster — map/DB eksikliği veya yan kanal hatası veriyi gizlemez.
  const adsUnknown =
    tenant.googleAdsMetrics.length === 0 &&
    (adsJob?.status === "error" || adsJob?.status !== "success");
  const metaUnknown =
    tenant.metaInsights.length === 0 &&
    (metaJob?.status === "error" || metaJob?.status !== "success");
  const health = healthFromJobs(tenant.syncJobs, tenant.alerts);

  const from = range.from;
  const to = range.to;

  const googleCampaigns = adsUnknown
    ? []
    : groupGoogleCampaigns(tenant.googleAdsMetrics);
  const googleAccount = adsUnknown
    ? { ...EMPTY_ACCOUNT }
    : sumCampaigns(googleCampaigns);

  const metaCampaigns = metaUnknown
    ? []
    : groupMetaCampaigns(tenant.type, tenant.metaInsights);
  const metaAccount = metaUnknown
    ? { ...EMPTY_ACCOUNT, campaign: "Meta toplam" }
    : sumCampaigns(metaCampaigns, "Meta toplam");

  const prevGoogleCampaigns = adsUnknown
    ? []
    : groupGoogleCampaigns(prevGoogleRows);
  const prevMetaCampaigns = metaUnknown
    ? []
    : groupMetaCampaigns(tenant.type, prevMetaRows);

  const creativeByAdId = new Map(
    tenant.metaAds.map((a) => [a.adId, a] as const),
  );
  const metaAdsById = new Map<string, MockMetaAdPerformance>();
  for (const row of tenant.metaAdInsights) {
    const creative = creativeByAdId.get(row.adId);
    const prev = metaAdsById.get(row.adId) || {
      adId: row.adId,
      adName: row.adName || creative?.adName || "(unnamed)",
      campaignName: row.campaignName || creative?.campaignName || "",
      adsetName: row.adsetName || creative?.adsetName || "",
      effectiveStatus: creative?.effectiveStatus || "",
      thumbnailUrl: creative?.thumbnailUrl ?? null,
      imageUrl: creative?.imageUrl ?? null,
      permalinkUrl: creative?.permalinkUrl ?? null,
      linkUrl: creative?.linkUrl ?? null,
      spend: 0,
      impr: 0,
      clicks: 0,
      reach: 0,
      conv: 0,
      convValue: 0,
    };
    prev.spend += Number(row.spend);
    prev.impr += row.impressions;
    prev.clicks += metaLinkClicks(row);
    prev.reach += row.reach;
    const mc = metaConv(tenant.type, row);
    prev.conv += mc.conv;
    prev.convValue += mc.convValue;
    if (creative) {
      prev.adName = creative.adName || prev.adName;
      prev.campaignName = creative.campaignName || prev.campaignName;
      prev.adsetName = creative.adsetName || prev.adsetName;
      prev.effectiveStatus = creative.effectiveStatus;
      prev.thumbnailUrl = creative.thumbnailUrl;
      prev.imageUrl = creative.imageUrl;
      prev.permalinkUrl = creative.permalinkUrl;
      prev.linkUrl = creative.linkUrl;
    }
    metaAdsById.set(row.adId, prev);
  }
  // Creatives with no spend in range still show (active + past for presentation)
  for (const creative of tenant.metaAds) {
    if (metaAdsById.has(creative.adId)) continue;
    metaAdsById.set(creative.adId, {
      adId: creative.adId,
      adName: creative.adName,
      campaignName: creative.campaignName,
      adsetName: creative.adsetName,
      effectiveStatus: creative.effectiveStatus,
      thumbnailUrl: creative.thumbnailUrl,
      imageUrl: creative.imageUrl,
      permalinkUrl: creative.permalinkUrl,
      linkUrl: creative.linkUrl,
      spend: 0,
      impr: 0,
      clicks: 0,
      reach: 0,
      conv: 0,
      convValue: 0,
    });
  }
  const metaAds = [...metaAdsById.values()].sort((a, b) => b.spend - a.spend);

  const metaAdsetsById = new Map<string, MockMetaAdsetPerformance>();
  for (const row of tenant.metaAdsetInsights) {
    const prev = metaAdsetsById.get(row.adsetId) || {
      adsetId: row.adsetId,
      adsetName: row.adsetName || "(reklam grubu yok)",
      campaignName: row.campaignName || "",
      spend: 0,
      impr: 0,
      clicks: 0,
      reach: 0,
      conv: 0,
      convValue: 0,
    };
    prev.spend += Number(row.spend);
    prev.impr += row.impressions;
    prev.clicks += metaLinkClicks(row);
    prev.reach += row.reach;
    const mc = metaConv(tenant.type, row);
    prev.conv += mc.conv;
    prev.convValue += mc.convValue;
    if (row.adsetName) prev.adsetName = row.adsetName;
    if (row.campaignName) prev.campaignName = row.campaignName;
    metaAdsetsById.set(row.adsetId, prev);
  }
  const metaAdsets = [...metaAdsetsById.values()].sort(
    (a, b) => b.spend - a.spend,
  );

  const breakdownMap = new Map<string, MockMetaBreakdownRow>();
  for (const row of tenant.metaBreakdowns) {
    const kind = row.breakdown as MockMetaBreakdownRow["breakdown"];
    if (kind !== "placement" && kind !== "device" && kind !== "age") continue;
    const mapKey = `${kind}||${row.key}`;
    const prev = breakdownMap.get(mapKey) || {
      breakdown: kind,
      key: row.key,
      spend: 0,
      impr: 0,
      clicks: 0,
      reach: 0,
      conv: 0,
      convValue: 0,
    };
    prev.spend += Number(row.spend);
    prev.impr += row.impressions;
    prev.clicks += row.clicks;
    prev.reach += row.reach;
    prev.conv += Number(row.conversions ?? 0);
    prev.convValue += Number(row.convValue ?? 0);
    breakdownMap.set(mapKey, prev);
  }
  const metaBreakdowns = [...breakdownMap.values()].sort(
    (a, b) => b.spend - a.spend,
  );

  const dailyMap = new Map<string, MockMetaDailyPoint>();
  const funnelParts: ReturnType<typeof deriveMetaFunnel>[] = [];
  const videoParts: ReturnType<typeof deriveMetaVideo>[] = [];
  for (const m of tenant.metaInsights) {
    const key = dateKey(m.date);
    const prev = dailyMap.get(key) || {
      date: key,
      spend: 0,
      clicks: 0,
      conv: 0,
      convValue: 0,
    };
    prev.spend += Number(m.spend);
    prev.clicks += metaLinkClicks(m);
    const mc = metaConv(tenant.type, m);
    prev.conv += mc.conv;
    prev.convValue += mc.convValue;
    dailyMap.set(key, prev);

    const actions = asActionMap(m.actions);
    const actionValues = asActionMap(m.actionValues);
    funnelParts.push(deriveMetaFunnel(actions, actionValues));
    videoParts.push(deriveMetaVideo(actions));
  }
  const metaDaily = [...dailyMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const metaFunnel =
    funnelParts.length > 0 ? sumMetaFunnel(funnelParts) : { ...EMPTY_META_FUNNEL };
  const metaVideo =
    videoParts.length > 0 ? sumMetaVideo(videoParts) : { ...EMPTY_META_VIDEO };

  const spendByDay = new Map<string, MockDailySpendPoint>();
  if (!adsUnknown) {
    for (const m of tenant.googleAdsMetrics) {
      const key = dateKey(m.date);
      const prev = spendByDay.get(key) || {
        date: key,
        google: 0,
        meta: 0,
        total: 0,
      };
      prev.google += Number(m.cost);
      prev.googleConv = (prev.googleConv ?? 0) + Number(m.conversions);
      spendByDay.set(key, prev);
    }
  }
  if (!metaUnknown) {
    for (const m of tenant.metaInsights) {
      const key = dateKey(m.date);
      const prev = spendByDay.get(key) || {
        date: key,
        google: 0,
        meta: 0,
        total: 0,
      };
      prev.meta += Number(m.spend);
      prev.metaConv = (prev.metaConv ?? 0) + metaConv(tenant.type, m).conv;
      spendByDay.set(key, prev);
    }
  }
  const dailySpend = [...spendByDay.values()]
    .map((d) => ({ ...d, total: d.google + d.meta }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const periodSpend =
    (adsUnknown ? 0 : googleAccount.spend) +
    (metaUnknown ? 0 : metaAccount.spend);
  const periodConv =
    (adsUnknown ? 0 : googleAccount.conv) +
    (metaUnknown ? 0 : metaAccount.conv);

  const bothUnknown =
    adsUnknown &&
    metaUnknown &&
    tenant.googleAdsMetrics.length === 0 &&
    tenant.metaInsights.length === 0;

  let ga4: MockGa4Overview = { ...EMPTY_GA4 };
  const ga4Channels: MockTenantBundle["ga4Channels"] = [];
  const ga4Landings: MockTenantBundle["ga4Landings"] = [];

  if (ga4Job?.status === "error" && ga4Rows.length === 0) {
    // leave empty — unknown ≠ zero
  } else if (ga4Rows.length > 0) {
    // Oranlar / ortalamalar oturum ağırlıklı; kullanıcı günlük toplamdır (tekil değil).
    const ov = ga4Rows.filter((r) => r.dimensionType === "overview");
    let sessions = 0;
    let users = 0;
    let durW = 0;
    let bounceW = 0;
    let ppsW = 0;
    let convW = 0;
    let revenue: number | null = null;
    let transactions: number | null = null;
    for (const r of ov) {
      const sess = r.sessions ?? 0;
      sessions += sess;
      users += r.totalUsers ?? 0;
      durW += Number(r.averageSessionDuration ?? 0) * sess;
      bounceW += Number(r.bounceRate ?? 0) * sess;
      ppsW += Number(r.screenPageViewsPerSession ?? 0) * sess;
      convW += Number(r.sessionConversionRate ?? 0) * sess;
      if (r.purchaseRevenue != null) {
        revenue = (revenue ?? 0) + Number(r.purchaseRevenue);
      }
      if (r.transactions != null) {
        transactions = (transactions ?? 0) + r.transactions;
      }
    }
    if (ov.length > 0) {
      const w = (x: number) => (sessions > 0 ? x / sessions : 0);
      ga4 = {
        totalUsers: users,
        sessions,
        averageSessionDuration: w(durW),
        bounceRate: w(bounceW),
        screenPageViewsPerSession: w(ppsW),
        sessionConversionRate: w(convW),
        purchaseRevenue: revenue,
        transactions,
      };
    }
    const byChannel = new Map<string, MockTenantBundle["ga4Channels"][number]>();
    for (const r of ga4Rows.filter((x) => x.dimensionType === "channel")) {
      const prev = byChannel.get(r.dimensionValue) || {
        dimension: r.dimensionValue,
        sessions: 0,
        users: 0,
        conversions: 0,
      };
      prev.sessions += r.sessions ?? 0;
      prev.users += r.totalUsers ?? 0;
      prev.conversions +=
        r.keyEvents != null
          ? Number(r.keyEvents)
          : (r.sessions ?? 0) * Number(r.sessionConversionRate ?? 0);
      byChannel.set(r.dimensionValue, prev);
    }
    ga4Channels.push(
      ...[...byChannel.values()].sort((a, b) => b.sessions - a.sessions),
    );
    // Açılış sayfaları DB'de tutulmaz — yalnızca canlı GA4.
  }

  return {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      website: tenant.website,
      metaAccountId: tenant.metaAccountId,
      type: tenant.type,
      timezone: tenant.timezone,
      currency: tenant.currency,
      visible: tenant.visible,
      coverUrl: tenant.coverUrl,
      mapping: {
        adsCustomerId: tenant.mapping?.adsCustomerId ?? null,
        ga4PropertyId:
          resolveGa4PropertyId({
            slug: tenant.slug,
            name: tenant.name,
            mapping: tenant.mapping,
          }) ??
          tenant.mapping?.ga4PropertyId ??
          null,
        gtmContainerId:
          resolveGtmPublicId({
            slug: tenant.slug,
            name: tenant.name,
            mapping: tenant.mapping,
          }) ??
          tenant.mapping?.gtmContainerId ??
          null,
        gscSiteUrl: tenant.mapping?.gscSiteUrl ?? null,
        merchantId: tenant.mapping?.merchantId ?? null,
        adsTimezone: tenant.mapping?.adsTimezone ?? null,
      },
    },
    thresholds: {
      budgetPaceWarnPct: tenant.thresholds?.budgetPaceWarnPct ?? 85,
      convDropoutDays: tenant.thresholds?.convDropoutDays ?? 3,
      minSpendForAlert: tenant.thresholds?.minSpendForAlert
        ? Number(tenant.thresholds.minSpendForAlert)
        : 100,
    },
    health: bothUnknown ? "unknown" : health,
    periodSpend,
    periodConv,
    lastCheckAt:
      adsJob?.lastSuccessAt?.toISOString() ??
      metaJob?.lastSuccessAt?.toISOString() ??
      null,
    current: {
      from,
      to,
      account: googleAccount,
      campaigns: googleCampaigns,
    },
    previous: {
      from: prevRange.from,
      to: prevRange.to,
      account: sumCampaigns(prevGoogleCampaigns),
      campaigns: prevGoogleCampaigns,
    },
    metaCurrent: {
      from,
      to,
      account: metaAccount,
      campaigns: metaCampaigns,
    },
    metaPrevious: {
      from: prevRange.from,
      to: prevRange.to,
      account: sumCampaigns(prevMetaCampaigns, "Meta toplam"),
      campaigns: prevMetaCampaigns,
    },
    metaAds,
    metaAdsets,
    metaBreakdowns,
    metaDaily,
    dailySpend,
    metaFunnel,
    metaVideo,
    conversions: [
      ...(metaUnknown
        ? []
        : metaConversionKinds(tenant.type, tenant.metaInsights)),
      ...(adsUnknown ? [] : groupGoogleConversions(tenant.conversions)),
    ],
    alerts: tenant.alerts.map((a) => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      message: a.message || "",
      assignee: a.assignee?.email ?? null,
      resolved: a.resolved,
      updatedAt: a.updatedAt.toISOString(),
    })),
    syncJobs: tenant.syncJobs.map((j) => ({
      provider: j.provider as "google" | "meta",
      service: j.service,
      objective: j.objective,
      status: j.status,
      lastSuccessAt: j.lastSuccessAt?.toISOString() ?? null,
      error: j.error,
    })),
    ga4,
    ga4Channels,
    ga4Landings,
    gtm: {
      ...EMPTY_GTM,
      publicId:
        resolveGtmPublicId({
          slug: tenant.slug,
          name: tenant.name,
          mapping: tenant.mapping,
        }) ||
        tenant.mapping?.gtmContainerId ||
        "",
      siteVerified: tenant.siteVerification?.status ?? "not_tested",
      siteVerifySummary: tenant.siteVerification?.summary ?? null,
      siteVerifyCheckedAt:
        tenant.siteVerification?.checkedAt?.toISOString() ?? null,
      siteVerifyScenarios: Array.isArray(tenant.siteVerification?.scenarios)
        ? (tenant.siteVerification!.scenarios as MockGtmSnapshot["siteVerifyScenarios"])
        : [],
    },
  };
}

const loadTenantBundle = cache(async function loadTenantBundle(
  slug: string,
  from: string,
  to: string,
): Promise<MockTenantBundle | null> {
  if (useMockPanelData()) {
    return getMockBundleBySlug(slug) ?? null;
  }
  return bundleFromDb(slug, { from, to });
});

export async function getTenantBundle(
  slug: string,
  range?: BundleRangeOpts,
): Promise<MockTenantBundle | null> {
  if (useMockPanelData()) {
    return getMockBundleBySlug(slug) ?? null;
  }

  if (!range) {
    const today = istanbulYmd();
    return loadTenantBundle(
      slug,
      startOfIstanbulMonthYmd(today),
      today,
    );
  }
  return loadTenantBundle(slug, range.from, range.to);
}

export async function getAgencyOverview(opts: {
  role: Role;
  tenantIds: string[];
  hostSlug: string;
  range?: BundleRangeOpts;
}): Promise<MockTenantBundle[]> {
  if (useMockPanelData()) {
    let rows = listVisibleMockBundles();
    if (opts.role === "client") {
      const allowed = new Set<string>([opts.hostSlug]);
      if (opts.tenantIds.length) {
        const memberships = await prisma.tenant.findMany({
          where: { id: { in: opts.tenantIds } },
          select: { slug: true },
        });
        for (const m of memberships) allowed.add(m.slug);
      }
      rows = rows.filter((r) => allowed.has(r.tenant.slug));
    }
    return rows;
  }

  const dbTenants = await prisma.tenant.findMany({
    where: { visible: true },
    select: { slug: true, id: true },
    orderBy: { name: "asc" },
  });

  let slugs = dbTenants.map((t) => t.slug);
  if (opts.role === "client") {
    const allowed = new Set<string>([opts.hostSlug]);
    const memberships = await prisma.tenant.findMany({
      where: { id: { in: opts.tenantIds } },
      select: { slug: true },
    });
    for (const m of memberships) allowed.add(m.slug);
    slugs = slugs.filter((s) => allowed.has(s));
  }

  const bundles: MockTenantBundle[] = [];
  for (const slug of slugs) {
    const b = await getTenantBundle(slug, opts.range);
    if (b) bundles.push(b);
  }
  return bundles;
}

export type AgencyBrandCard = {
  slug: string;
  name: string;
  visible: boolean;
  coverUrl: string | null;
  health: HealthStatus | null;
};

async function filterSlugsForRole(
  slugs: string[],
  opts: { role: Role; tenantIds: string[]; hostSlug: string },
): Promise<string[]> {
  if (opts.role !== "client") return slugs;
  const allowed = new Set<string>([opts.hostSlug]);
  if (opts.tenantIds.length) {
    const memberships = await prisma.tenant.findMany({
      where: { id: { in: opts.tenantIds } },
      select: { slug: true },
    });
    for (const m of memberships) allowed.add(m.slug);
  }
  return slugs.filter((s) => allowed.has(s));
}

/** Ajans marka kartları. Sağlık sync job + açık alert’ten gelir; metrik bundle yüklenmez. */
export async function listAgencyBrands(opts: {
  role: Role;
  tenantIds: string[];
  hostSlug: string;
  visible: boolean;
  range?: BundleRangeOpts;
}): Promise<AgencyBrandCard[]> {
  if (useMockPanelData()) {
    const rows = listMockBundlesByVisible(opts.visible);
    const slugs = await filterSlugsForRole(
      rows.map((r) => r.tenant.slug),
      opts,
    );
    const allowed = new Set(slugs);
    return rows
      .filter((r) => allowed.has(r.tenant.slug))
      .map((r) => ({
        slug: r.tenant.slug,
        name: r.tenant.name,
        visible: r.tenant.visible,
        coverUrl: r.tenant.coverUrl,
        health: opts.visible ? r.health : null,
      }));
  }

  const dbTenants = await prisma.tenant.findMany({
    where: { visible: opts.visible },
    select: {
      slug: true,
      name: true,
      visible: true,
      coverUrl: true,
      syncJobs: {
        select: { service: true, status: true, error: true },
      },
      alerts: {
        where: { resolved: false },
        select: { severity: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const slugs = await filterSlugsForRole(
    dbTenants.map((t) => t.slug),
    opts,
  );
  const allowed = new Set(slugs);
  const tenants = dbTenants.filter((t) => allowed.has(t.slug));

  return tenants.map((t) => ({
    slug: t.slug,
    name: t.name,
    visible: t.visible,
    coverUrl: t.coverUrl,
    health: opts.visible ? healthFromJobs(t.syncJobs, t.alerts) : null,
  }));
}

export async function countAgencyBrands(opts: {
  role: Role;
  tenantIds: string[];
  hostSlug: string;
}): Promise<{ active: number; inactive: number }> {
  if (useMockPanelData()) {
    const counts = countMockBundlesByVisible();
    if (opts.role !== "client") return counts;
    const [active, inactive] = await Promise.all([
      listAgencyBrands({ ...opts, visible: true }),
      listAgencyBrands({ ...opts, visible: false }),
    ]);
    return { active: active.length, inactive: inactive.length };
  }

  if (opts.role === "client") {
    const [active, inactive] = await Promise.all([
      listAgencyBrands({ ...opts, visible: true }),
      listAgencyBrands({ ...opts, visible: false }),
    ]);
    return { active: active.length, inactive: inactive.length };
  }

  const [active, inactive] = await Promise.all([
    prisma.tenant.count({ where: { visible: true } }),
    prisma.tenant.count({ where: { visible: false } }),
  ]);
  return { active, inactive };
}

export function requireBundle(
  slug: string,
  range?: BundleRangeOpts,
): Promise<MockTenantBundle> {
  return getTenantBundle(slug, range).then((b) => {
    if (!b) throw new Error(`Bundle missing for ${slug}`);
    return b;
  });
}

export const HEALTH_LABEL: Record<HealthStatus, string> = {
  ok: "Sorun yok",
  warn: "Uyarı",
  critical: "Kritik",
  unknown: "Kontrol edilemedi",
};
