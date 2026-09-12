import type { AlertSeverity, ConversionKind, Role, TenantType } from "@prisma/client";
import { getTenantBySlug, prisma, TenantAccessError } from "@/lib/db";
import { useMockPanelData } from "@/lib/integrations/tokens";
import {
  deriveMetaFunnel,
  deriveMetaVideo,
  sumMetaFunnel,
  sumMetaVideo,
} from "@/lib/integrations/meta/metrics";
import { istanbulYmd, startOfIstanbulMonthYmd, ymdToUtcDate } from "@/lib/date/tr";
import {
  EMPTY_META_FUNNEL,
  EMPTY_META_VIDEO,
  getMockBundleBySlug,
  listVisibleMockBundles,
  type HealthStatus,
  type MockCampaignMetric,
  type MockGa4Overview,
  type MockGtmSnapshot,
  type MockMetaAdPerformance,
  type MockMetaAdsetPerformance,
  type MockMetaBreakdownRow,
  type MockMetaDailyPoint,
  type MockPeriodMetrics,
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

function emptyPeriod(from: string, to: string): MockPeriodMetrics {
  return { from, to, account: { ...EMPTY_ACCOUNT }, campaigns: [] };
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
      reach: hasReach ? (acc.reach ?? 0) + (c.reach ?? 0) : undefined,
      frequency: undefined,
    }),
    { ...EMPTY_ACCOUNT, campaign: label },
  );
}

export async function resolvePanelTenant(slug: string) {
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
  const monthlyBudget = dbTenant?.monthlyBudget
    ? Number(dbTenant.monthlyBudget)
    : (mock?.tenant.monthlyBudget ?? null);
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
    monthlyBudget,
    timezone,
    mapping,
    bundle: mock ?? null,
  };
}

function healthFromJobs(
  jobs: { service: string; status: string; error: string | null }[],
  openAlerts: { severity: AlertSeverity }[],
): HealthStatus {
  if (openAlerts.some((a) => a.severity === "critical")) return "critical";

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
      ga4Metrics: {
        where: { date: dateFilter },
        take: 60,
      },
      conversions: {
        orderBy: { updatedAt: "desc" },
        take: 50,
      },
    },
  });
  if (!tenant) return null;

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

  const googleByCamp = new Map<string, MockCampaignMetric>();
  for (const m of tenant.googleAdsMetrics) {
    const key = m.campaignName || "Google Ads";
    const prev = googleByCamp.get(key) || {
      campaign: key,
      spend: 0,
      impr: 0,
      clicks: 0,
      conv: 0,
      convValue: 0,
    };
    prev.spend += Number(m.cost);
    prev.impr += m.impressions;
    prev.clicks += m.clicks;
    prev.conv += Number(m.conversions);
    prev.convValue += Number(m.convValue);
    googleByCamp.set(key, prev);
  }
  const googleCampaigns = adsUnknown ? [] : [...googleByCamp.values()];
  const googleAccount = adsUnknown
    ? { ...EMPTY_ACCOUNT }
    : sumCampaigns(googleCampaigns);

  const metaByCamp = new Map<string, MockCampaignMetric>();
  for (const m of tenant.metaInsights) {
    const key = m.campaignName || "Meta Ads";
    const prev = metaByCamp.get(key) || {
      campaign: key,
      spend: 0,
      impr: 0,
      clicks: 0,
      conv: 0,
      convValue: 0,
      reach: 0,
    };
    prev.spend += Number(m.spend);
    prev.impr += m.impressions;
    prev.clicks += m.clicks;
    prev.conv += Number(m.conversions ?? 0);
    prev.convValue += Number(m.convValue ?? 0);
    prev.reach = (prev.reach ?? 0) + (m.reach ?? 0);
    metaByCamp.set(key, prev);
  }
  const metaCampaigns = metaUnknown ? [] : [...metaByCamp.values()];
  const metaAccount = metaUnknown
    ? { ...EMPTY_ACCOUNT, campaign: "Meta toplam" }
    : sumCampaigns(metaCampaigns, "Meta toplam");

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
    prev.clicks += row.clicks;
    prev.reach += row.reach;
    prev.conv += Number(row.conversions ?? 0);
    prev.convValue += Number(row.convValue ?? 0);
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
    prev.clicks += row.clicks;
    prev.reach += row.reach;
    prev.conv += Number(row.conversions ?? 0);
    prev.convValue += Number(row.convValue ?? 0);
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
    prev.clicks += m.clicks;
    prev.conv += Number(m.conversions ?? 0);
    prev.convValue += Number(m.convValue ?? 0);
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

  if (ga4Job?.status === "error" && tenant.ga4Metrics.length === 0) {
    // leave empty — unknown ≠ zero
  } else if (tenant.ga4Metrics.length > 0) {
    const overviewRows = tenant.ga4Metrics.filter(
      (r) => r.dimensionType === "overview",
    );
    const ov = overviewRows[0];
    if (ov) {
      ga4 = {
        totalUsers: ov.totalUsers ?? 0,
        sessions: ov.sessions ?? 0,
        averageSessionDuration: Number(ov.averageSessionDuration ?? 0),
        bounceRate: Number(ov.bounceRate ?? 0),
        screenPageViewsPerSession: Number(ov.screenPageViewsPerSession ?? 0),
        sessionConversionRate: Number(ov.sessionConversionRate ?? 0),
        purchaseRevenue:
          ov.purchaseRevenue != null ? Number(ov.purchaseRevenue) : null,
        transactions: ov.transactions ?? null,
      };
    }
    for (const r of tenant.ga4Metrics.filter(
      (x) => x.dimensionType === "channel",
    )) {
      const sessions = r.sessions ?? 0;
      const rate = Number(r.sessionConversionRate ?? 0);
      ga4Channels.push({
        dimension: r.dimensionValue,
        sessions,
        users: r.totalUsers ?? 0,
        conversions: Math.round(sessions * rate),
      });
    }
    for (const r of tenant.ga4Metrics.filter(
      (x) => x.dimensionType === "landing",
    )) {
      const sessions = r.sessions ?? 0;
      const rate = Number(r.sessionConversionRate ?? 0);
      ga4Landings.push({
        dimension: r.dimensionValue,
        sessions,
        users: r.totalUsers ?? 0,
        conversions: Math.round(sessions * rate),
      });
    }
  }

  return {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      website: tenant.website,
      metaAccountId: tenant.metaAccountId,
      type: tenant.type,
      monthlyBudget: tenant.monthlyBudget ? Number(tenant.monthlyBudget) : 0,
      timezone: tenant.timezone,
      currency: tenant.currency,
      visible: tenant.visible,
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
    previous: emptyPeriod(from, to),
    metaCurrent: {
      from,
      to,
      account: metaAccount,
      campaigns: metaCampaigns,
    },
    metaPrevious: emptyPeriod(from, to),
    metaAds,
    metaAdsets,
    metaBreakdowns,
    metaDaily,
    metaFunnel,
    metaVideo,
    conversions: tenant.conversions.map((c) => ({
      name: c.name,
      source: c.source,
      primary: c.primary,
      count: c.count,
      kind: c.kind as ConversionKind,
      dupeFlag: c.dupeFlag,
    })),
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

export async function getTenantBundle(
  slug: string,
  range?: BundleRangeOpts,
): Promise<MockTenantBundle | null> {
  if (useMockPanelData()) {
    return getMockBundleBySlug(slug) ?? null;
  }

  // live / auto+credentials: never invent mock numbers — empty DB = empty UI
  if (!range) {
    const today = istanbulYmd();
    return bundleFromDb(slug, {
      from: startOfIstanbulMonthYmd(today),
      to: today,
    });
  }
  return bundleFromDb(slug, range);
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
