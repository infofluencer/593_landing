import type {
  AlertSeverity,
  ConversionKind,
  SyncStatus,
  TenantType,
} from "@prisma/client";

export type HealthStatus = AlertSeverity;

export type MockTenant = {
  id: string;
  slug: string;
  name: string;
  website: string | null;
  metaAccountId: string;
  type: TenantType;
  monthlyBudget: number;
  timezone: string;
  currency: string;
  visible: boolean;
  mapping: {
    adsCustomerId: string | null;
    ga4PropertyId: string | null;
    gtmContainerId: string | null;
    gscSiteUrl: string | null;
    merchantId: string | null;
  };
};

export type MockCampaignMetric = {
  campaign: string;
  campaignId?: string;
  spend: number;
  impr: number;
  clicks: number;
  conv: number;
  convValue: number;
  reach?: number;
  frequency?: number;
  objective?: string;
};

export type MockPeriodMetrics = {
  from: string;
  to: string;
  account: MockCampaignMetric;
  campaigns: MockCampaignMetric[];
};

export type MockConversion = {
  name: string;
  source: string;
  primary: boolean;
  count: number;
  kind: ConversionKind;
  dupeFlag: boolean;
};

export type MockAlert = {
  id: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  assignee: string | null;
  resolved: boolean;
  updatedAt: string;
};

export type MockSyncJob = {
  provider: "google" | "meta";
  service: string;
  objective?: string;
  status: SyncStatus;
  lastSuccessAt: string | null;
  error: string | null;
};

export type MockGa4Overview = {
  totalUsers: number;
  sessions: number;
  averageSessionDuration: number;
  bounceRate: number;
  screenPageViewsPerSession: number;
  sessionConversionRate: number;
  purchaseRevenue?: number | null;
  transactions?: number | null;
};

export type MockGa4Row = {
  dimension: string;
  sessions: number;
  users: number;
  conversions: number;
};

export type MockGtmTag = {
  name: string;
  type: string;
  paused: boolean;
  expected: boolean;
  measurementIdOk: boolean;
};

export type MockGtmSnapshot = {
  publicId: string;
  liveVersion: string;
  unpublishedChanges: boolean;
  tags: MockGtmTag[];
  triggers: number;
  variables: number;
  siteVerified:
    | "not_tested"
    | "pass"
    | "fail"
    | "partial"
    | "unknown"
    | "error";
  siteVerifySummary?: string | null;
  siteVerifyCheckedAt?: string | null;
  siteVerifyScenarios?: Array<{
    id: string;
    label: string;
    ok: boolean;
    notes: string[];
    signals?: Record<string, boolean>;
  }>;
};

export type MockThresholds = {
  budgetPaceWarnPct: number;
  convDropoutDays: number;
  minSpendForAlert: number;
};

export type MockTenantBundle = {
  tenant: MockTenant;
  thresholds: MockThresholds;
  health: HealthStatus;
  periodSpend: number;
  periodConv: number;
  lastCheckAt: string | null;
  /** Google Ads period */
  current: MockPeriodMetrics;
  previous: MockPeriodMetrics;
  /** Meta paid insights */
  metaCurrent: MockPeriodMetrics;
  metaPrevious: MockPeriodMetrics;
  conversions: MockConversion[];
  alerts: MockAlert[];
  syncJobs: MockSyncJob[];
  ga4: MockGa4Overview;
  ga4Channels: MockGa4Row[];
  ga4Landings: MockGa4Row[];
  gtm: MockGtmSnapshot;
};

const TODAY = "2026-09-04";

function period(
  from: string,
  to: string,
  account: MockCampaignMetric,
  campaigns: MockCampaignMetric[],
): MockPeriodMetrics {
  return { from, to, account, campaigns };
}

function camp(
  name: string,
  spend: number,
  impr: number,
  clicks: number,
  conv: number,
  convValue: number,
  extra?: Partial<MockCampaignMetric>,
): MockCampaignMetric {
  return { campaign: name, spend, impr, clicks, conv, convValue, ...extra };
}

export function derivedMetrics(m: MockCampaignMetric) {
  const ctr = m.impr > 0 ? (m.clicks / m.impr) * 100 : 0;
  const cpc = m.clicks > 0 ? m.spend / m.clicks : 0;
  const cpa = m.conv > 0 ? m.spend / m.conv : 0;
  const roas = m.spend > 0 ? m.convValue / m.spend : 0;
  return { ctr, cpc, cpa, roas };
}

export function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function estimateMonthEndSpend(
  spendToDate: number,
  dayOfMonth: number,
  daysInMonth: number,
): number {
  if (dayOfMonth <= 0) return 0;
  return (spendToDate / dayOfMonth) * daysInMonth;
}

export function mockToday(): Date {
  return new Date(`${TODAY}T12:00:00+03:00`);
}

const syncOk = (
  provider: "google" | "meta",
  service: string,
  at: string,
  objective = "default",
): MockSyncJob => ({
  provider,
  service,
  objective,
  status: "success",
  lastSuccessAt: at,
  error: null,
});

export const MOCK_TENANTS: MockTenantBundle[] = [
  // ── ecommerce ──
  {
    tenant: {
      id: "mock_mareen",
      slug: "mareen",
      name: "MAREEN",
      website: "https://mareen.com.tr/",
      metaAccountId: "act_mareen_001",
      type: "ecommerce",
      monthlyBudget: 120000,
      timezone: "Europe/Istanbul",
      currency: "TRY",
      visible: true,
      mapping: {
        adsCustomerId: "444-555-6666",
        ga4PropertyId: "properties/987654321",
        gtmContainerId: "123/456",
        gscSiteUrl: "https://mareen.com.tr/",
        merchantId: "merchant_mareen",
      },
    },
    thresholds: {
      budgetPaceWarnPct: 85,
      convDropoutDays: 3,
      minSpendForAlert: 100,
    },
    health: "warn",
    periodSpend: 142650,
    periodConv: 580,
    lastCheckAt: "2026-09-04T07:40:00+03:00",
    current: period(
      "2026-08-01",
      "2026-08-31",
      camp("Hesap toplamı", 78450, 980000, 22400, 312, 890000),
      [
        camp("Shopping — Marka", 28600, 320000, 8100, 148, 420000),
        camp("Search — Genel", 24800, 410000, 9200, 96, 280000),
        camp("PMax — Katalog", 25050, 250000, 5100, 68, 190000),
      ],
    ),
    previous: period(
      "2026-07-01",
      "2026-07-31",
      camp("Hesap toplamı", 71200, 910000, 20100, 290, 820000),
      [
        camp("Shopping — Marka", 26000, 300000, 7600, 136, 390000),
        camp("Search — Genel", 23000, 380000, 8500, 90, 260000),
        camp("PMax — Katalog", 22200, 230000, 4000, 64, 170000),
      ],
    ),
    metaCurrent: period(
      "2026-08-01",
      "2026-08-31",
      camp("Meta toplam", 64200, 2100000, 38500, 268, 720000, {
        reach: 980000,
        frequency: 2.14,
        objective: "OUTCOME_SALES",
      }),
      [
        camp("Advantage+ Alışveriş", 38000, 1200000, 21000, 168, 450000, {
          reach: 560000,
          frequency: 2.1,
          objective: "OUTCOME_SALES",
        }),
        camp("Prospecting — Lookalike", 26200, 900000, 17500, 100, 270000, {
          reach: 420000,
          frequency: 2.2,
          objective: "OUTCOME_SALES",
        }),
      ],
    ),
    metaPrevious: period(
      "2026-07-01",
      "2026-07-31",
      camp("Meta toplam", 58100, 1900000, 35200, 240, 650000, {
        reach: 900000,
        frequency: 2.1,
      }),
      [],
    ),
    conversions: [
      {
        name: "Purchase",
        source: "Google Ads etiketi",
        primary: true,
        count: 210,
        kind: "sale",
        dupeFlag: false,
      },
      {
        name: "purchase",
        source: "GA4 import",
        primary: false,
        count: 198,
        kind: "sale",
        dupeFlag: true,
      },
      {
        name: "Meta omni_purchase",
        source: "Meta Ads",
        primary: true,
        count: 268,
        kind: "sale",
        dupeFlag: false,
      },
      {
        name: "WhatsApp",
        source: "Google Ads etiketi",
        primary: false,
        count: 24,
        kind: "whatsapp",
        dupeFlag: false,
      },
    ],
    alerts: [
      {
        id: "a_mareen_1",
        type: "spend_pace",
        severity: "warn",
        message: "Ayın 4’ünde bütçenin %65’i harandı — tempo yüksek.",
        assignee: "medya@593emarketing.com",
        resolved: false,
        updatedAt: "2026-09-04T07:40:00+03:00",
      },
      {
        id: "a_mareen_2",
        type: "dupe_conversion",
        severity: "warn",
        message: "Purchase hem Ads etiketi hem GA4 import ile sayılıyor.",
        assignee: null,
        resolved: false,
        updatedAt: "2026-09-02T16:20:00+03:00",
      },
    ],
    syncJobs: [
      syncOk("google", "ads", "2026-09-04T07:40:00+03:00", "campaign_daily"),
      syncOk("meta", "insights", "2026-09-04T07:38:00+03:00", "campaign_daily"),
      syncOk("google", "ga4", "2026-09-04T07:35:00+03:00", "overview"),
      syncOk("google", "gtm", "2026-09-03T18:00:00+03:00", "config"),
      syncOk("google", "merchant", "2026-09-04T06:00:00+03:00", "product_status"),
    ],
    ga4: {
      totalUsers: 84200,
      sessions: 112400,
      averageSessionDuration: 148,
      bounceRate: 0.42,
      screenPageViewsPerSession: 3.4,
      sessionConversionRate: 0.028,
      purchaseRevenue: 890000,
      transactions: 312,
    },
    ga4Channels: [
      { dimension: "Paid Search", sessions: 22400, users: 18200, conversions: 96 },
      { dimension: "Paid Social", sessions: 31000, users: 24800, conversions: 140 },
      { dimension: "Organic Search", sessions: 28000, users: 22100, conversions: 48 },
      { dimension: "Direct", sessions: 18000, users: 15100, conversions: 28 },
    ],
    ga4Landings: [
      { dimension: "/collections/sal", sessions: 9200, users: 7800, conversions: 42 },
      { dimension: "/", sessions: 11000, users: 9400, conversions: 18 },
      { dimension: "/products/ipek-sal", sessions: 6100, users: 5200, conversions: 55 },
    ],
    gtm: {
      publicId: "GTM-MAREEN",
      liveVersion: "v48 — 2026-08-28",
      unpublishedChanges: true,
      triggers: 18,
      variables: 24,
      siteVerified: "not_tested",
      tags: [
        { name: "GA4 Config", type: "gaawc", paused: false, expected: true, measurementIdOk: true },
        { name: "Google Ads Conversion", type: "awct", paused: false, expected: true, measurementIdOk: true },
        { name: "Meta Pixel", type: "html", paused: false, expected: true, measurementIdOk: true },
        { name: "Old UA", type: "ua", paused: true, expected: false, measurementIdOk: false },
      ],
    },
  },

  // ── lead ──
  {
    tenant: {
      id: "mock_demo",
      slug: "demo",
      name: "Demo Lead Marka",
      website: "https://example.com",
      metaAccountId: "act_phase0_demo",
      type: "lead",
      monthlyBudget: 50000,
      timezone: "Europe/Istanbul",
      currency: "TRY",
      visible: true,
      mapping: {
        adsCustomerId: "111-222-3333",
        ga4PropertyId: "properties/123456789",
        gtmContainerId: "111/222",
        gscSiteUrl: "https://example.com/",
        merchantId: null,
      },
    },
    thresholds: {
      budgetPaceWarnPct: 90,
      convDropoutDays: 3,
      minSpendForAlert: 50,
    },
    health: "ok",
    periodSpend: 40520,
    periodConv: 238,
    lastCheckAt: "2026-09-04T08:15:00+03:00",
    current: period(
      "2026-08-01",
      "2026-08-31",
      camp("Hesap toplamı", 18420, 412000, 9800, 142, 0),
      [
        camp("Brand Arama", 4200, 88000, 3100, 48, 0),
        camp("Search — Lead", 9100, 210000, 4200, 71, 0),
        camp("Remarketing", 5120, 114000, 2500, 23, 0),
      ],
    ),
    previous: period(
      "2026-07-01",
      "2026-07-31",
      camp("Hesap toplamı", 16200, 390000, 9100, 128, 0),
      [
        camp("Brand Arama", 3900, 82000, 2900, 44, 0),
        camp("Search — Lead", 8400, 198000, 3900, 62, 0),
        camp("Remarketing", 3900, 110000, 2300, 22, 0),
      ],
    ),
    metaCurrent: period(
      "2026-08-01",
      "2026-08-31",
      camp("Meta toplam", 22100, 890000, 14200, 96, 0, {
        reach: 410000,
        frequency: 2.17,
        objective: "OUTCOME_LEADS",
      }),
      [
        camp("Lead form — Randevu", 12800, 520000, 7800, 58, 0, {
          reach: 240000,
          objective: "OUTCOME_LEADS",
        }),
        camp("WhatsApp — Mesaj", 9300, 370000, 6400, 38, 0, {
          reach: 170000,
          objective: "OUTCOME_ENGAGEMENT",
        }),
      ],
    ),
    metaPrevious: period(
      "2026-07-01",
      "2026-07-31",
      camp("Meta toplam", 19800, 820000, 13100, 88, 0, {
        reach: 380000,
        frequency: 2.1,
      }),
      [],
    ),
    conversions: [
      {
        name: "Form gönderimi",
        source: "Google Ads etiketi",
        primary: true,
        count: 86,
        kind: "form",
        dupeFlag: false,
      },
      {
        name: "generate_lead",
        source: "GA4 import",
        primary: false,
        count: 81,
        kind: "form",
        dupeFlag: true,
      },
      {
        name: "Meta lead",
        source: "Meta Ads",
        primary: true,
        count: 58,
        kind: "form",
        dupeFlag: false,
      },
      {
        name: "WhatsApp konuşma",
        source: "Meta Ads",
        primary: false,
        count: 38,
        kind: "whatsapp",
        dupeFlag: false,
      },
      {
        name: "WhatsApp tıklama",
        source: "Google Ads etiketi",
        primary: false,
        count: 18,
        kind: "whatsapp",
        dupeFlag: false,
      },
    ],
    alerts: [
      {
        id: "a_demo_1",
        type: "mapping_ok",
        severity: "ok",
        message: "Ads / GA4 / GTM / Meta eşleştirmeleri tamam.",
        assignee: null,
        resolved: true,
        updatedAt: "2026-09-03T12:00:00+03:00",
      },
    ],
    syncJobs: [
      syncOk("google", "ads", "2026-09-04T08:15:00+03:00", "campaign_daily"),
      syncOk("meta", "insights", "2026-09-04T08:10:00+03:00", "campaign_daily"),
      syncOk("google", "ga4", "2026-09-04T08:12:00+03:00", "overview"),
      syncOk("google", "gtm", "2026-09-03T18:00:00+03:00", "config"),
    ],
    ga4: {
      totalUsers: 28400,
      sessions: 36200,
      averageSessionDuration: 96,
      bounceRate: 0.51,
      screenPageViewsPerSession: 2.1,
      sessionConversionRate: 0.045,
      purchaseRevenue: null,
      transactions: null,
    },
    ga4Channels: [
      { dimension: "Paid Search", sessions: 9800, users: 8200, conversions: 71 },
      { dimension: "Paid Social", sessions: 11200, users: 9100, conversions: 58 },
      { dimension: "Organic Search", sessions: 8400, users: 7100, conversions: 22 },
      { dimension: "Direct", sessions: 4800, users: 4000, conversions: 12 },
    ],
    ga4Landings: [
      { dimension: "/randevu", sessions: 6200, users: 5400, conversions: 48 },
      { dimension: "/", sessions: 8100, users: 6900, conversions: 14 },
      { dimension: "/iletisim", sessions: 3100, users: 2800, conversions: 26 },
    ],
    gtm: {
      publicId: "GTM-DEMO01",
      liveVersion: "v12 — 2026-08-20",
      unpublishedChanges: false,
      triggers: 11,
      variables: 14,
      siteVerified: "not_tested",
      tags: [
        { name: "GA4 Config", type: "gaawc", paused: false, expected: true, measurementIdOk: true },
        { name: "Google Ads Lead Conv", type: "awct", paused: false, expected: true, measurementIdOk: true },
        { name: "Meta Pixel", type: "html", paused: false, expected: true, measurementIdOk: true },
      ],
    },
  },
];

export function getMockBundleBySlug(slug: string): MockTenantBundle | undefined {
  return MOCK_TENANTS.find((t) => t.tenant.slug === slug);
}

export function listVisibleMockBundles(): MockTenantBundle[] {
  return MOCK_TENANTS.filter((t) => t.tenant.visible);
}
