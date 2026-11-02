import { prisma } from "@/lib/db";
import {
  addDaysYmd,
  istanbulYmd,
  startOfIstanbulMonthYmd,
  ymdToUtcDate,
} from "@/lib/date/tr";
import { displayCampaignName } from "@/lib/panel/brand-budget";
import { isIntegrationDisabled } from "@/lib/panel/integrations";

/**
 * Aktif kampanyalar — tüm markaların şu an yayında olan kampanyaları tek
 * ekranda. "Aktif" tanımı bütçe planlayıcıyla aynı:
 *  - Meta: reklam durumu biliniyorsa en az bir reklam ACTIVE; bilinmiyorsa
 *    son 7 günde harcama var.
 *  - Google: son 7 günde harcama var (GAQL yalnızca ENABLED kampanya çeker).
 */

export type ActiveCampaignProvider = "meta" | "google";

export type ActiveCampaign = {
  provider: ActiveCampaignProvider;
  campaignId: string;
  /** Görünen ad (kullanıcı etiketi varsa o). */
  name: string;
  /** API'den gelen orijinal ad — etiket varsa küçük yazılır. */
  sourceName: string;
  objective: string;
  audience: string;
  location: string;
  /** Meta: reklam durumundan kesin bilgi; Google / bilinmiyorsa null. */
  live: boolean | null;
  spendToday: number;
  spendYesterday: number;
  spend7d: number;
  spendMonth: number;
  impressions7d: number;
  clicks7d: number;
  conversions7d: number;
  convValue7d: number;
  monthlyBudget: number | null;
  dailyBudget: number | null;
  /** Son veri günü (YYYY-MM-DD) — null: henüz harcama yok. */
  lastDate: string | null;
};

export type ActiveCampaignBrand = {
  id: string;
  slug: string;
  name: string;
  coverUrl: string | null;
  currency: string;
  campaigns: ActiveCampaign[];
  spendYesterday: number;
  spend7d: number;
  spendMonth: number;
  /** Markanın bu ayki toplam plan bütçesi (varsa). */
  monthlyBudget: number | null;
};

export type ActiveCampaignsSnapshot = {
  today: string;
  yesterday: string;
  from7: string;
  monthStart: string;
  brands: ActiveCampaignBrand[];
  totals: {
    campaigns: number;
    brands: number;
    meta: number;
    google: number;
    spendYesterday: number;
    spend7d: number;
    spendMonth: number;
  };
};

type MetricRow = {
  tenantId: string;
  campaignId: string;
  campaignName: string;
  objective: string | null;
  spendToday: number;
  spendYesterday: number;
  spend7d: number;
  spendMonth: number;
  impressions7d: number;
  clicks7d: number;
  conversions7d: number;
  convValue7d: number;
  lastDate: string | null;
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function money(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function key(tenantId: string, provider: ActiveCampaignProvider, campaignId: string) {
  return `${tenantId}|${provider}|${campaignId}`;
}

export async function loadActiveCampaigns(opts?: {
  today?: string;
}): Promise<ActiveCampaignsSnapshot> {
  const today = opts?.today ?? istanbulYmd(new Date());
  const yesterday = addDaysYmd(today, -1);
  const from7 = addDaysYmd(today, -6);
  const monthStart = startOfIstanbulMonthYmd(today);
  const windowStart = from7 < monthStart ? from7 : monthStart;
  const month = today.slice(0, 7);

  const dToday = ymdToUtcDate(today);
  const dYesterday = ymdToUtcDate(yesterday);
  const dFrom7 = ymdToUtcDate(from7);
  const dMonth = ymdToUtcDate(monthStart);
  const dWindow = ymdToUtcDate(windowStart);

  const [tenants, metaRows, googleRows, metaAds, aliases, campaignBudgets, tenantBudgets] =
    await Promise.all([
      prisma.tenant.findMany({
        where: { visible: true },
        select: {
          id: true,
          slug: true,
          name: true,
          coverUrl: true,
          currency: true,
          disabledIntegrations: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.$queryRaw<MetricRow[]>`
        SELECT
          "tenantId",
          "campaignId",
          MAX("campaignName") AS "campaignName",
          MAX(objective) AS objective,
          SUM(CASE WHEN date = ${dToday} THEN spend ELSE 0 END)::float8 AS "spendToday",
          SUM(CASE WHEN date = ${dYesterday} THEN spend ELSE 0 END)::float8 AS "spendYesterday",
          SUM(CASE WHEN date >= ${dFrom7} THEN spend ELSE 0 END)::float8 AS "spend7d",
          SUM(CASE WHEN date >= ${dMonth} THEN spend ELSE 0 END)::float8 AS "spendMonth",
          SUM(CASE WHEN date >= ${dFrom7} THEN impressions ELSE 0 END)::float8 AS "impressions7d",
          SUM(CASE WHEN date >= ${dFrom7} THEN clicks ELSE 0 END)::float8 AS "clicks7d",
          SUM(CASE WHEN date >= ${dFrom7} THEN COALESCE(conversions, 0) ELSE 0 END)::float8 AS "conversions7d",
          SUM(CASE WHEN date >= ${dFrom7} THEN COALESCE("convValue", 0) ELSE 0 END)::float8 AS "convValue7d",
          MAX(CASE WHEN spend > 0 THEN to_char(date, 'YYYY-MM-DD') END) AS "lastDate"
        FROM "MetaInsight"
        WHERE date >= ${dWindow} AND date <= ${dToday} AND "campaignId" <> ''
        GROUP BY "tenantId", "campaignId"
      `,
      prisma.$queryRaw<MetricRow[]>`
        SELECT
          "tenantId",
          "campaignId",
          MAX("campaignName") AS "campaignName",
          NULL::text AS objective,
          SUM(CASE WHEN date = ${dToday} THEN cost ELSE 0 END)::float8 AS "spendToday",
          SUM(CASE WHEN date = ${dYesterday} THEN cost ELSE 0 END)::float8 AS "spendYesterday",
          SUM(CASE WHEN date >= ${dFrom7} THEN cost ELSE 0 END)::float8 AS "spend7d",
          SUM(CASE WHEN date >= ${dMonth} THEN cost ELSE 0 END)::float8 AS "spendMonth",
          SUM(CASE WHEN date >= ${dFrom7} THEN impressions ELSE 0 END)::float8 AS "impressions7d",
          SUM(CASE WHEN date >= ${dFrom7} THEN clicks ELSE 0 END)::float8 AS "clicks7d",
          SUM(CASE WHEN date >= ${dFrom7} THEN conversions ELSE 0 END)::float8 AS "conversions7d",
          SUM(CASE WHEN date >= ${dFrom7} THEN "convValue" ELSE 0 END)::float8 AS "convValue7d",
          MAX(CASE WHEN cost > 0 THEN to_char(date, 'YYYY-MM-DD') END) AS "lastDate"
        FROM "GoogleAdsMetric"
        WHERE date >= ${dWindow} AND date <= ${dToday} AND "campaignId" <> ''
        GROUP BY "tenantId", "campaignId"
      `,
      prisma.metaAd.findMany({
        select: {
          tenantId: true,
          campaignId: true,
          campaignName: true,
          effectiveStatus: true,
        },
      }),
      prisma.campaignAlias.findMany({
        select: {
          tenantId: true,
          provider: true,
          campaignId: true,
          label: true,
          audience: true,
          location: true,
        },
      }),
      prisma.campaignBudget.findMany({
        where: { month },
        select: {
          tenantId: true,
          provider: true,
          campaignId: true,
          monthlyBudget: true,
          dailyBudget: true,
        },
      }),
      prisma.tenantBudget.findMany({
        where: { month },
        select: { tenantId: true, monthlyBudget: true },
      }),
    ]);

  // Meta reklam durumu: kampanya → (reklam var mı, yayında reklam var mı, ad)
  const metaHasAd = new Set<string>();
  const metaLive = new Set<string>();
  const metaAdName = new Map<string, string>();
  for (const ad of metaAds) {
    const id = ad.campaignId.trim();
    if (!id) continue;
    const k = key(ad.tenantId, "meta", id);
    metaHasAd.add(k);
    if (ad.effectiveStatus === "ACTIVE") metaLive.add(k);
    if (ad.campaignName && !metaAdName.has(k)) metaAdName.set(k, ad.campaignName);
  }

  const aliasMap = new Map(
    aliases.map((a) => [key(a.tenantId, a.provider, a.campaignId), a] as const),
  );
  const budgetMap = new Map(
    campaignBudgets.map((b) => [key(b.tenantId, b.provider, b.campaignId), b] as const),
  );
  const tenantBudgetMap = new Map(
    tenantBudgets.map((b) => [b.tenantId, money(b.monthlyBudget)] as const),
  );

  const byTenant = new Map<string, Map<string, ActiveCampaign>>();
  function bucket(tenantId: string) {
    let m = byTenant.get(tenantId);
    if (!m) {
      m = new Map();
      byTenant.set(tenantId, m);
    }
    return m;
  }

  function build(
    tenantId: string,
    provider: ActiveCampaignProvider,
    campaignId: string,
    sourceName: string,
    row: MetricRow | null,
    live: boolean | null,
  ): ActiveCampaign {
    const k = key(tenantId, provider, campaignId);
    const alias = aliasMap.get(k);
    const budget = budgetMap.get(k);
    return {
      provider,
      campaignId,
      name: displayCampaignName({ campaignName: sourceName, label: alias?.label }),
      sourceName,
      objective: row?.objective ?? "",
      audience: alias?.audience ?? "",
      location: alias?.location ?? "",
      live,
      spendToday: num(row?.spendToday),
      spendYesterday: num(row?.spendYesterday),
      spend7d: num(row?.spend7d),
      spendMonth: num(row?.spendMonth),
      impressions7d: num(row?.impressions7d),
      clicks7d: num(row?.clicks7d),
      conversions7d: num(row?.conversions7d),
      convValue7d: num(row?.convValue7d),
      monthlyBudget: money(budget?.monthlyBudget),
      dailyBudget: money(budget?.dailyBudget),
      lastDate: row?.lastDate ?? null,
    };
  }

  const tenantById = new Map(tenants.map((t) => [t.id, t] as const));

  for (const row of metaRows) {
    const t = tenantById.get(row.tenantId);
    if (!t || isIntegrationDisabled(t, "meta")) continue;
    const id = row.campaignId.trim();
    const k = key(t.id, "meta", id);
    const live = metaHasAd.has(k) ? metaLive.has(k) : null;
    const active = live ?? num(row.spend7d) > 0;
    if (!active) continue;
    bucket(t.id).set(k, build(t.id, "meta", id, row.campaignName, row, live));
  }
  // Yayında görünen ama henüz harcaması olmayan Meta kampanyaları (yeni çıkanlar).
  for (const k of metaLive) {
    const [tenantId, , campaignId] = k.split("|") as [string, string, string];
    const t = tenantById.get(tenantId);
    if (!t || isIntegrationDisabled(t, "meta")) continue;
    const b = bucket(tenantId);
    if (b.has(k)) continue;
    b.set(k, build(tenantId, "meta", campaignId, metaAdName.get(k) ?? campaignId, null, true));
  }
  for (const row of googleRows) {
    const t = tenantById.get(row.tenantId);
    if (!t || isIntegrationDisabled(t, "google_ads")) continue;
    if (num(row.spend7d) <= 0) continue;
    const id = row.campaignId.trim();
    bucket(t.id).set(key(t.id, "google", id), build(t.id, "google", id, row.campaignName, row, null));
  }

  const brands: ActiveCampaignBrand[] = [];
  for (const t of tenants) {
    const m = byTenant.get(t.id);
    if (!m || m.size === 0) continue;
    const campaigns = [...m.values()].sort(
      (a, b) => b.spend7d - a.spend7d || a.name.localeCompare(b.name, "tr"),
    );
    brands.push({
      id: t.id,
      slug: t.slug,
      name: t.name,
      coverUrl: t.coverUrl,
      currency: t.currency,
      campaigns,
      spendYesterday: campaigns.reduce((s, c) => s + c.spendYesterday, 0),
      spend7d: campaigns.reduce((s, c) => s + c.spend7d, 0),
      spendMonth: campaigns.reduce((s, c) => s + c.spendMonth, 0),
      monthlyBudget: tenantBudgetMap.get(t.id) ?? null,
    });
  }

  const all = brands.flatMap((b) => b.campaigns);
  return {
    today,
    yesterday,
    from7,
    monthStart,
    brands,
    totals: {
      campaigns: all.length,
      brands: brands.length,
      meta: all.filter((c) => c.provider === "meta").length,
      google: all.filter((c) => c.provider === "google").length,
      spendYesterday: all.reduce((s, c) => s + c.spendYesterday, 0),
      spend7d: all.reduce((s, c) => s + c.spend7d, 0),
      spendMonth: all.reduce((s, c) => s + c.spendMonth, 0),
    },
  };
}
