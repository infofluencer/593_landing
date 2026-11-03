import { prisma } from "@/lib/db";
import {
  addDaysYmd,
  istanbulYmd,
  startOfIstanbulMonthYmd,
  ymdToUtcDate,
} from "@/lib/date/tr";
import { displayCampaignName } from "@/lib/panel/brand-budget";
import { isIntegrationDisabled } from "@/lib/panel/integrations";
import { SYNC_AD_LEVEL_DAYS } from "@/lib/panel/period";

/**
 * Kampanyalar ekranı — tüm markaların Meta reklam setleri ve Google kampanyaları.
 * Metrikler seçili döneme göre hesaplanır; listede dönemde harcaması olanlar ve
 * dönem bugünü kapsıyorsa şu an yayında olan Meta reklam setleri yer alır.
 *  - Meta durumu reklam seti bazında: en az bir reklam ACTIVE ise yayında.
 *  - Google: durum bilgisi yok, son harcama gününe bakılır (GAQL yalnızca
 *    ENABLED kampanya çeker).
 */

export type ActiveCampaignProvider = "meta" | "google";

export type ActiveCampaign = {
  provider: ActiveCampaignProvider;
  /** Google: kampanya kimliği; Meta: reklam seti kimliği. */
  campaignId: string;
  /** Meta: reklam setinin bağlı olduğu kampanya; Google'da null. */
  parentCampaignName: string | null;
  /** Görünen ad (kullanıcı etiketi varsa o). */
  name: string;
  /** API'den gelen orijinal ad — etiket varsa küçük yazılır. */
  sourceName: string;
  objective: string;
  audience: string;
  location: string;
  /** Meta: reklam durumundan kesin bilgi; Google / bilinmiyorsa null. */
  live: boolean | null;
  /** Seçili dönem metrikleri. */
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  convValue: number;
  /** Bu ay harcaması — aylık planla karşılaştırma için, dönemden bağımsız. */
  spendMonth: number;
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
  spend: number;
  spendMonth: number;
  /** Markanın bu ayki toplam plan bütçesi (varsa). */
  monthlyBudget: number | null;
};

export type ActiveCampaignsSnapshot = {
  today: string;
  yesterday: string;
  /** Dönem, Meta reklam seti verisinin çekildiği aralıktan daha eskiye gidiyor. */
  adsetHistoryLimited: boolean;
  brands: ActiveCampaignBrand[];
  totals: {
    campaigns: number;
    brands: number;
    meta: number;
    google: number;
    spend: number;
    conversions: number;
    spendMonth: number;
  };
};

type MetricRow = {
  tenantId: string;
  campaignId: string;
  campaignName: string;
  parentCampaignName: string | null;
  objective: string | null;
  spend: number;
  spendMonth: number;
  impressions: number;
  clicks: number;
  conversions: number;
  convValue: number;
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

export async function loadActiveCampaigns(opts: {
  startDate: string;
  endDate: string;
  today?: string;
}): Promise<ActiveCampaignsSnapshot> {
  const { startDate, endDate } = opts;
  const today = opts.today ?? istanbulYmd(new Date());
  const yesterday = addDaysYmd(today, -1);
  const from7 = addDaysYmd(today, -6);
  const monthStart = startOfIstanbulMonthYmd(today);
  // Durum rozeti ve aylık plan için pencere dönemden bağımsız en az son 7 gün + bu ay.
  const windowStart = [startDate, from7, monthStart].sort()[0]!;
  const includesToday = endDate >= today;
  const month = today.slice(0, 7);

  const dToday = ymdToUtcDate(today);
  const dStart = ymdToUtcDate(startDate);
  const dEnd = ymdToUtcDate(endDate);
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
          a."tenantId",
          a."adsetId" AS "campaignId",
          MAX(a."adsetName") AS "campaignName",
          MAX(a."campaignName") AS "parentCampaignName",
          MAX(o.objective) AS objective,
          SUM(CASE WHEN a.date BETWEEN ${dStart} AND ${dEnd} THEN a.spend ELSE 0 END)::float8 AS spend,
          SUM(CASE WHEN a.date >= ${dMonth} THEN a.spend ELSE 0 END)::float8 AS "spendMonth",
          SUM(CASE WHEN a.date BETWEEN ${dStart} AND ${dEnd} THEN a.impressions ELSE 0 END)::float8 AS impressions,
          SUM(CASE WHEN a.date BETWEEN ${dStart} AND ${dEnd} THEN a.clicks ELSE 0 END)::float8 AS clicks,
          SUM(CASE WHEN a.date BETWEEN ${dStart} AND ${dEnd} THEN COALESCE(a.conversions, 0) ELSE 0 END)::float8 AS conversions,
          SUM(CASE WHEN a.date BETWEEN ${dStart} AND ${dEnd} THEN COALESCE(a."convValue", 0) ELSE 0 END)::float8 AS "convValue",
          MAX(CASE WHEN a.spend > 0 THEN to_char(a.date, 'YYYY-MM-DD') END) AS "lastDate"
        FROM "MetaAdsetInsight" a
        LEFT JOIN (
          SELECT "tenantId", "campaignId", MAX(objective) AS objective
          FROM "MetaInsight"
          WHERE date >= ${dWindow} AND date <= ${dToday}
          GROUP BY "tenantId", "campaignId"
        ) o ON o."tenantId" = a."tenantId" AND o."campaignId" = a."campaignId"
        WHERE a.date >= ${dWindow} AND a.date <= ${dToday} AND a."adsetId" <> ''
        GROUP BY a."tenantId", a."adsetId"
      `,
      prisma.$queryRaw<MetricRow[]>`
        SELECT
          "tenantId",
          "campaignId",
          MAX("campaignName") AS "campaignName",
          NULL::text AS "parentCampaignName",
          NULL::text AS objective,
          SUM(CASE WHEN date BETWEEN ${dStart} AND ${dEnd} THEN cost ELSE 0 END)::float8 AS spend,
          SUM(CASE WHEN date >= ${dMonth} THEN cost ELSE 0 END)::float8 AS "spendMonth",
          SUM(CASE WHEN date BETWEEN ${dStart} AND ${dEnd} THEN impressions ELSE 0 END)::float8 AS impressions,
          SUM(CASE WHEN date BETWEEN ${dStart} AND ${dEnd} THEN clicks ELSE 0 END)::float8 AS clicks,
          SUM(CASE WHEN date BETWEEN ${dStart} AND ${dEnd} THEN conversions ELSE 0 END)::float8 AS conversions,
          SUM(CASE WHEN date BETWEEN ${dStart} AND ${dEnd} THEN "convValue" ELSE 0 END)::float8 AS "convValue",
          MAX(CASE WHEN cost > 0 THEN to_char(date, 'YYYY-MM-DD') END) AS "lastDate"
        FROM "GoogleAdsMetric"
        WHERE date >= ${dWindow} AND date <= ${dToday} AND "campaignId" <> ''
        GROUP BY "tenantId", "campaignId"
      `,
      prisma.metaAd.findMany({
        select: {
          tenantId: true,
          adsetId: true,
          adsetName: true,
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

  // Meta reklam durumu: reklam seti → (reklam var mı, yayında reklam var mı, ad)
  const metaHasAd = new Set<string>();
  const metaLive = new Set<string>();
  const metaAdsetInfo = new Map<string, { name: string; parentName: string }>();
  for (const ad of metaAds) {
    const id = ad.adsetId.trim();
    if (!id) continue;
    const k = key(ad.tenantId, "meta", id);
    metaHasAd.add(k);
    if (ad.effectiveStatus === "ACTIVE") metaLive.add(k);
    if (ad.adsetName && !metaAdsetInfo.has(k)) {
      metaAdsetInfo.set(k, { name: ad.adsetName, parentName: ad.campaignName });
    }
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
    parentCampaignName: string | null,
    row: MetricRow | null,
    live: boolean | null,
  ): ActiveCampaign {
    const k = key(tenantId, provider, campaignId);
    const alias = aliasMap.get(k);
    const budget = budgetMap.get(k);
    return {
      provider,
      campaignId,
      parentCampaignName,
      name: displayCampaignName({ campaignName: sourceName, label: alias?.label }),
      sourceName,
      objective: row?.objective ?? "",
      audience: alias?.audience ?? "",
      location: alias?.location ?? "",
      live,
      spend: num(row?.spend),
      impressions: num(row?.impressions),
      clicks: num(row?.clicks),
      conversions: num(row?.conversions),
      convValue: num(row?.convValue),
      spendMonth: num(row?.spendMonth),
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
    if (num(row.spend) <= 0 && !(live && includesToday)) continue;
    bucket(t.id).set(k, build(t.id, "meta", id, row.campaignName, row.parentCampaignName, row, live));
  }
  // Yayında görünen ama henüz harcaması olmayan Meta reklam setleri (yeni çıkanlar).
  for (const k of includesToday ? metaLive : []) {
    const [tenantId, , campaignId] = k.split("|") as [string, string, string];
    const t = tenantById.get(tenantId);
    if (!t || isIntegrationDisabled(t, "meta")) continue;
    const b = bucket(tenantId);
    if (b.has(k)) continue;
    const info = metaAdsetInfo.get(k);
    b.set(k, build(tenantId, "meta", campaignId, info?.name ?? campaignId, info?.parentName ?? null, null, true));
  }
  for (const row of googleRows) {
    const t = tenantById.get(row.tenantId);
    if (!t || isIntegrationDisabled(t, "google_ads")) continue;
    if (num(row.spend) <= 0) continue;
    const id = row.campaignId.trim();
    bucket(t.id).set(key(t.id, "google", id), build(t.id, "google", id, row.campaignName, null, row, null));
  }

  const brands: ActiveCampaignBrand[] = [];
  for (const t of tenants) {
    const m = byTenant.get(t.id);
    if (!m || m.size === 0) continue;
    const campaigns = [...m.values()].sort(
      (a, b) => b.spend - a.spend || a.name.localeCompare(b.name, "tr"),
    );
    brands.push({
      id: t.id,
      slug: t.slug,
      name: t.name,
      coverUrl: t.coverUrl,
      currency: t.currency,
      campaigns,
      spend: campaigns.reduce((s, c) => s + c.spend, 0),
      spendMonth: campaigns.reduce((s, c) => s + c.spendMonth, 0),
      monthlyBudget: tenantBudgetMap.get(t.id) ?? null,
    });
  }

  const all = brands.flatMap((b) => b.campaigns);
  return {
    today,
    yesterday,
    adsetHistoryLimited: startDate < addDaysYmd(today, -SYNC_AD_LEVEL_DAYS),
    brands,
    totals: {
      campaigns: all.length,
      brands: brands.length,
      meta: all.filter((c) => c.provider === "meta").length,
      google: all.filter((c) => c.provider === "google").length,
      spend: all.reduce((s, c) => s + c.spend, 0),
      conversions: all.reduce((s, c) => s + c.conversions, 0),
      spendMonth: all.reduce((s, c) => s + c.spendMonth, 0),
    },
  };
}
