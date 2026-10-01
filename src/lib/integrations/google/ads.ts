import {
  getGoogleAccessToken,
  getGoogleAdsDeveloperToken,
  getGoogleAdsLoginCustomerId,
} from "@/lib/integrations/tokens";
import { iterateYmdRanges } from "@/lib/date/tr";
import { countsAsPanelConversion } from "@/lib/panel/classify-conversion";

export type AdsTenantType = "ecommerce" | "lead";

/** Uzun geçmişi parçala — tek GAQL isteği küçük kalsın. */
const ADS_CHUNK_DAYS = 90;

const ADS_API = "https://googleads.googleapis.com/v25";

export type AdsCampaignRow = {
  campaignId: string;
  campaign: string;
  date: string;
  spend: number;
  impr: number;
  clicks: number;
  conv: number;
  convValue: number;
  /** metrics.all_conversions — ikincil aksiyonlar dahil (yalnızca teşhis). */
  allConv: number;
};

function microsToCurrency(micros: string | number): number {
  const n = typeof micros === "string" ? Number(micros) : micros;
  return Number.isFinite(n) ? n / 1_000_000 : 0;
}

type AdsErrorJson = {
  error?: {
    message?: string;
    status?: string;
    code?: number;
    details?: Array<{
      errors?: Array<{
        errorCode?: Record<string, string>;
        message?: string;
      }>;
    }>;
  };
};

async function adsAuthHint(accessToken: string): Promise<string> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
    );
    const json = (await res.json()) as { scope?: string; error?: string };
    if (!res.ok) return `tokeninfo: ${json.error || res.status}`;
    const scope = json.scope || "";
    const hasAdwords = /\badwords\b/.test(scope);
    return `scopesHasAdwords=${hasAdwords}; scopeCount=${scope.split(/\s+/).filter(Boolean).length}`;
  } catch (err) {
    return `tokeninfo failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function formatAdsHttpError(
  res: Response,
  json: AdsErrorJson,
  customerId: string,
  hint: string,
): Error {
  const top = json.error?.message || `Google Ads API ${res.status}`;
  const detail = json.error?.details?.[0]?.errors?.[0];
  const code = detail?.errorCode
    ? Object.entries(detail.errorCode)
        .map(([k, v]) => `${k}:${v}`)
        .join(",")
    : "";
  const detailMsg = detail?.message ? ` — ${detail.message}` : "";
  const codePart = code ? ` [${code}]` : "";
  const status = json.error?.status ? ` ${json.error.status}` : "";
  return new Error(
    `${top}${status}${codePart}${detailMsg} (customer ${customerId}; ${hint})`,
  );
}

async function adsSearch(opts: {
  customerId: string;
  query: string;
}): Promise<{ json: AdsErrorJson & { results?: unknown[] } }> {
  const accessToken = await getGoogleAccessToken();
  const developerToken = getGoogleAdsDeveloperToken();
  const loginCustomerId = getGoogleAdsLoginCustomerId();
  const customerId = opts.customerId.replace(/-/g, "");

  // googleAds:search sayfa başına 10k satır döner — nextPageToken bitene kadar çek.
  const results: unknown[] = [];
  let pageToken: string | undefined;
  do {
    const res = await fetch(
      `${ADS_API}/customers/${customerId}/googleAds:search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken,
          "login-customer-id": loginCustomerId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          pageToken ? { query: opts.query, pageToken } : { query: opts.query },
        ),
      },
    );

    const json = (await res.json()) as AdsErrorJson & {
      results?: unknown[];
      nextPageToken?: string;
    };
    if (!res.ok) {
      const hint = await adsAuthHint(accessToken);
      throw formatAdsHttpError(res, json, customerId, hint);
    }
    results.push(...(json.results ?? []));
    pageToken = json.nextPageToken || undefined;
  } while (pageToken);

  return { json: { results } };
}

/** customer.time_zone — segments.date bu saat dilimindedir. */
export async function fetchAdsCustomerTimeZone(
  customerId: string,
): Promise<string | null> {
  const { json } = await adsSearch({
    customerId,
    query: "SELECT customer.time_zone FROM customer LIMIT 1",
  });
  const row = (json.results ?? [])[0] as
    | { customer?: { timeZone?: string } }
    | undefined;
  return row?.customer?.timeZone || null;
}

/** Kampanya × gün × dönüşüm aksiyonu (yalnızca birincil `metrics.conversions`). */
export type AdsConversionDayRow = {
  campaignId: string;
  date: string;
  name: string;
  category: string | null;
  conv: number;
  convValue: number;
  /** Bu marka tipinde panel dönüşümü sayılıyor mu (countsAsPanelConversion). */
  counted: boolean;
};

/**
 * GAQL read via Google Ads API search (login-customer-id = MCC).
 * Never invents zeros on auth/API failure — caller must record SyncJob.error.
 *
 * Harcama·gösterim·tıklama tüm kampanyadan. conv/convValue aksiyon segmentinden,
 * marka tipine göre süzülür (countsAsPanelConversion):
 * - ecommerce: yalnızca satın alım (PURCHASE / STORE_SALE / satın alım adı)
 * - lead: sayfa görüntüleme / sepete ekleme gibi mikro adımlar hariç birincil aksiyonlar
 * Kaldırılmış (REMOVED) kampanyalar da çekilir — geçmiş harcama eksilmesin.
 */
export async function fetchGoogleAdsCampaignMetrics(opts: {
  customerId: string;
  from: string; // YYYY-MM-DD
  to: string;
  tenantType: AdsTenantType;
}): Promise<{ campaigns: AdsCampaignRow[]; conversions: AdsConversionDayRow[] }> {
  const customerId = opts.customerId.replace(/-/g, "");
  const campaigns: AdsCampaignRow[] = [];
  const conversions: AdsConversionDayRow[] = [];

  for (const range of iterateYmdRanges(opts.from, opts.to, ADS_CHUNK_DAYS)) {
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        segments.date,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.conversions_value,
        metrics.all_conversions
      FROM campaign
      WHERE segments.date BETWEEN '${range.from}' AND '${range.to}'
    `;
    const { json } = await adsSearch({ customerId, query });

    const rows = ((json.results ?? []) as Array<{
      campaign?: { id?: string; name?: string };
      segments?: { date?: string };
      metrics?: {
        costMicros?: string;
        impressions?: string;
        clicks?: string;
        conversions?: number;
        conversionsValue?: number;
        allConversions?: number;
      };
    }>).map((row) => {
      const name = row.campaign?.name || "(unnamed)";
      return {
        campaignId: row.campaign?.id || name,
        campaign: name,
        date: row.segments?.date || range.from,
        spend: microsToCurrency(row.metrics?.costMicros ?? 0),
        impr: Number(row.metrics?.impressions ?? 0),
        clicks: Number(row.metrics?.clicks ?? 0),
        conv: Number(row.metrics?.conversions ?? 0),
        convValue: Number(row.metrics?.conversionsValue ?? 0),
        allConv: Number(row.metrics?.allConversions ?? 0),
      };
    });

    const convRows = await fetchConversionsByCampaignDay({
      customerId,
      from: range.from,
      to: range.to,
      tenantType: opts.tenantType,
    });
    conversions.push(...convRows);

    const countedByKey = new Map<string, { conv: number; convValue: number }>();
    for (const c of convRows) {
      if (!c.counted) continue;
      const key = `${c.campaignId}|${c.date}`;
      const prev = countedByKey.get(key) ?? { conv: 0, convValue: 0 };
      prev.conv += c.conv;
      prev.convValue += c.convValue;
      countedByKey.set(key, prev);
    }

    for (const row of rows) {
      const hit = countedByKey.get(`${row.campaignId}|${row.date}`);
      campaigns.push({
        ...row,
        conv: hit?.conv ?? 0,
        convValue: hit?.convValue ?? 0,
      });
    }
  }

  return { campaigns, conversions };
}

/** Campaign × day × conversion action (name + category). */
async function fetchConversionsByCampaignDay(opts: {
  customerId: string;
  from: string;
  to: string;
  tenantType: AdsTenantType;
}): Promise<AdsConversionDayRow[]> {
  const query = `
    SELECT
      campaign.id,
      segments.date,
      segments.conversion_action_name,
      segments.conversion_action_category,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${opts.from}' AND '${opts.to}'
      AND metrics.conversions > 0
  `;

  const { json } = await adsSearch({
    customerId: opts.customerId,
    query,
  });

  const out: AdsConversionDayRow[] = [];
  for (const row of (json.results ?? []) as Array<{
    campaign?: { id?: string };
    segments?: {
      date?: string;
      conversionActionName?: string;
      conversionActionCategory?: string;
    };
    metrics?: { conversions?: number; conversionsValue?: number };
  }>) {
    const campaignId = row.campaign?.id;
    const date = row.segments?.date;
    if (!campaignId || !date) continue;
    const name = row.segments?.conversionActionName || "Unknown";
    const category = row.segments?.conversionActionCategory ?? null;
    out.push({
      campaignId,
      date,
      name,
      category,
      conv: Number(row.metrics?.conversions ?? 0),
      convValue: Number(row.metrics?.conversionsValue ?? 0),
      counted: countsAsPanelConversion(opts.tenantType, category, name),
    });
  }
  return out;
}

/**
 * Detay tabloları (reklam grubu / kelime / arama terimi) için aynı dönüşüm
 * kuralı: aksiyon segmentli ikinci sorgu → anahtar başına sayılan conv/value.
 * Segment desteklenmezse null döner (çağıran ham metrics.conversions'ı korur).
 */
async function countedConversionsByKey(opts: {
  customerId: string;
  from: string;
  to: string;
  tenantType: AdsTenantType;
  resource: string;
  selectKeys: string[];
  extraWhere: string;
  keyOf: (row: Record<string, unknown>) => string | null;
}): Promise<Map<string, { conv: number; convValue: number }> | null> {
  const query = `
    SELECT
      ${opts.selectKeys.join(",\n      ")},
      segments.conversion_action_name,
      segments.conversion_action_category,
      metrics.conversions,
      metrics.conversions_value
    FROM ${opts.resource}
    WHERE segments.date BETWEEN '${opts.from}' AND '${opts.to}'
      AND metrics.conversions > 0
      ${opts.extraWhere}
  `;
  try {
    const { json } = await adsSearch({ customerId: opts.customerId, query });
    const map = new Map<string, { conv: number; convValue: number }>();
    for (const raw of (json.results ?? []) as Array<Record<string, unknown>>) {
      const seg = raw.segments as
        | { conversionActionName?: string; conversionActionCategory?: string }
        | undefined;
      const m = raw.metrics as
        | { conversions?: number; conversionsValue?: number }
        | undefined;
      if (
        !countsAsPanelConversion(
          opts.tenantType,
          seg?.conversionActionCategory,
          seg?.conversionActionName || "",
        )
      ) {
        continue;
      }
      const key = opts.keyOf(raw);
      if (!key) continue;
      const prev = map.get(key) ?? { conv: 0, convValue: 0 };
      prev.conv += Number(m?.conversions ?? 0);
      prev.convValue += Number(m?.conversionsValue ?? 0);
      map.set(key, prev);
    }
    return map;
  } catch (err) {
    console.warn(
      `[ads] ${opts.resource} dönüşüm segmenti alınamadı:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

function applyCounted<T extends { conv: number; convValue: number }>(
  rows: T[],
  counted: Map<string, { conv: number; convValue: number }> | null,
  keyOf: (row: T) => string,
): T[] {
  if (!counted) return rows;
  return rows.map((row) => {
    const hit = counted.get(keyOf(row));
    return { ...row, conv: hit?.conv ?? 0, convValue: hit?.convValue ?? 0 };
  });
}

export type AdsAdGroupRow = {
  campaignId: string;
  campaign: string;
  adGroupId: string;
  adGroup: string;
  spend: number;
  impr: number;
  clicks: number;
  conv: number;
  convValue: number;
};

export type AdsKeywordRow = {
  campaignId: string;
  campaign: string;
  adGroupId: string;
  adGroup: string;
  keyword: string;
  matchType: string;
  spend: number;
  impr: number;
  clicks: number;
  conv: number;
  convValue: number;
};

export type AdsSearchTermRow = {
  searchTerm: string;
  campaignId: string;
  campaign: string;
  adGroupId: string;
  adGroup: string;
  spend: number;
  impr: number;
  clicks: number;
  conv: number;
  convValue: number;
};

type MetricsFields = {
  costMicros?: string;
  impressions?: string;
  clicks?: string;
  conversions?: number;
  conversionsValue?: number;
};

function metricsFromRow(m?: MetricsFields) {
  return {
    spend: microsToCurrency(m?.costMicros ?? 0),
    impr: Number(m?.impressions ?? 0),
    clicks: Number(m?.clicks ?? 0),
    conv: Number(m?.conversions ?? 0),
    convValue: Number(m?.conversionsValue ?? 0),
  };
}

const METRIC_SELECT = `
  metrics.cost_micros,
  metrics.impressions,
  metrics.clicks,
  metrics.conversions,
  metrics.conversions_value
`;

/** Active-campaign ad groups for the date range (aggregated, top 50 by spend). */
export async function fetchAdsAdGroups(opts: {
  customerId: string;
  from: string;
  to: string;
  tenantType: AdsTenantType;
  limit?: number;
}): Promise<AdsAdGroupRow[]> {
  const customerId = opts.customerId.replace(/-/g, "");
  const limit = opts.limit ?? 50;
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ${METRIC_SELECT}
    FROM ad_group
    WHERE segments.date BETWEEN '${opts.from}' AND '${opts.to}'
      AND campaign.status = 'ENABLED'
      AND ad_group.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT ${limit}
  `;

  const { json } = await adsSearch({ customerId, query });

  const rows = ((json.results ?? []) as Array<{
    campaign?: { id?: string; name?: string };
    adGroup?: { id?: string; name?: string };
    metrics?: MetricsFields;
  }>).map((row) => {
    const campaign = row.campaign?.name || "(kampanya)";
    const adGroup = row.adGroup?.name || "(grup)";
    return {
      campaignId: row.campaign?.id || campaign,
      campaign,
      adGroupId: row.adGroup?.id || adGroup,
      adGroup,
      ...metricsFromRow(row.metrics),
    };
  });

  const ids = rows.map((r) => r.adGroupId).filter((id) => /^\d+$/.test(id));
  if (ids.length === 0) return rows;
  const counted = await countedConversionsByKey({
    customerId,
    from: opts.from,
    to: opts.to,
    tenantType: opts.tenantType,
    resource: "ad_group",
    selectKeys: ["ad_group.id"],
    extraWhere: `AND ad_group.id IN (${ids.join(",")})`,
    keyOf: (raw) => (raw.adGroup as { id?: string } | undefined)?.id ?? null,
  });
  return applyCounted(rows, counted, (r) => r.adGroupId);
}

/** Active-campaign keywords (keyword_view), top 50 by spend. */
export async function fetchAdsKeywords(opts: {
  customerId: string;
  from: string;
  to: string;
  tenantType: AdsTenantType;
  limit?: number;
}): Promise<AdsKeywordRow[]> {
  const customerId = opts.customerId.replace(/-/g, "");
  const limit = opts.limit ?? 50;
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ${METRIC_SELECT}
    FROM keyword_view
    WHERE segments.date BETWEEN '${opts.from}' AND '${opts.to}'
      AND campaign.status = 'ENABLED'
      AND ad_group_criterion.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT ${limit}
  `;

  const { json } = await adsSearch({ customerId, query });

  const criterionKeys: string[] = [];
  const rows = ((json.results ?? []) as Array<{
    campaign?: { id?: string; name?: string };
    adGroup?: { id?: string; name?: string };
    adGroupCriterion?: {
      criterionId?: string;
      keyword?: { text?: string; matchType?: string };
    };
    metrics?: MetricsFields;
  }>).map((row) => {
    const campaign = row.campaign?.name || "(kampanya)";
    const adGroup = row.adGroup?.name || "(grup)";
    const keyword = row.adGroupCriterion?.keyword?.text || "(kelime)";
    criterionKeys.push(
      `${row.adGroup?.id ?? ""}~${row.adGroupCriterion?.criterionId ?? ""}`,
    );
    return {
      campaignId: row.campaign?.id || campaign,
      campaign,
      adGroupId: row.adGroup?.id || adGroup,
      adGroup,
      keyword,
      matchType: row.adGroupCriterion?.keyword?.matchType || "—",
      ...metricsFromRow(row.metrics),
    };
  });

  const adGroupIds = [
    ...new Set(rows.map((r) => r.adGroupId).filter((id) => /^\d+$/.test(id))),
  ];
  if (adGroupIds.length === 0) return rows;
  const counted = await countedConversionsByKey({
    customerId,
    from: opts.from,
    to: opts.to,
    tenantType: opts.tenantType,
    resource: "keyword_view",
    selectKeys: ["ad_group.id", "ad_group_criterion.criterion_id"],
    extraWhere: `AND ad_group.id IN (${adGroupIds.join(",")})`,
    keyOf: (raw) => {
      const ag = (raw.adGroup as { id?: string } | undefined)?.id;
      const cr = (raw.adGroupCriterion as { criterionId?: string } | undefined)
        ?.criterionId;
      return ag && cr ? `${ag}~${cr}` : null;
    },
  });
  if (!counted) return rows;
  return rows.map((row, i) => {
    const hit = counted.get(criterionKeys[i]!);
    return { ...row, conv: hit?.conv ?? 0, convValue: hit?.convValue ?? 0 };
  });
}

/** Active-campaign search terms, top 50 by spend. Search campaigns only. */
export async function fetchAdsSearchTerms(opts: {
  customerId: string;
  from: string;
  to: string;
  tenantType: AdsTenantType;
  limit?: number;
}): Promise<AdsSearchTermRow[]> {
  const customerId = opts.customerId.replace(/-/g, "");
  const limit = opts.limit ?? 50;
  const query = `
    SELECT
      search_term_view.search_term,
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ${METRIC_SELECT}
    FROM search_term_view
    WHERE segments.date BETWEEN '${opts.from}' AND '${opts.to}'
      AND campaign.status = 'ENABLED'
    ORDER BY metrics.cost_micros DESC
    LIMIT ${limit}
  `;

  const { json } = await adsSearch({ customerId, query });

  const rows = ((json.results ?? []) as Array<{
    searchTermView?: { searchTerm?: string };
    campaign?: { id?: string; name?: string };
    adGroup?: { id?: string; name?: string };
    metrics?: MetricsFields;
  }>).map((row) => {
    const campaign = row.campaign?.name || "(kampanya)";
    const adGroup = row.adGroup?.name || "(grup)";
    return {
      searchTerm: row.searchTermView?.searchTerm || "(terim)",
      campaignId: row.campaign?.id || campaign,
      campaign,
      adGroupId: row.adGroup?.id || adGroup,
      adGroup,
      ...metricsFromRow(row.metrics),
    };
  });

  const adGroupIds = [
    ...new Set(rows.map((r) => r.adGroupId).filter((id) => /^\d+$/.test(id))),
  ];
  if (adGroupIds.length === 0) return rows;
  const counted = await countedConversionsByKey({
    customerId,
    from: opts.from,
    to: opts.to,
    tenantType: opts.tenantType,
    resource: "search_term_view",
    selectKeys: ["ad_group.id", "search_term_view.search_term"],
    extraWhere: `AND ad_group.id IN (${adGroupIds.join(",")})`,
    keyOf: (raw) => {
      const ag = (raw.adGroup as { id?: string } | undefined)?.id;
      const term = (raw.searchTermView as { searchTerm?: string } | undefined)
        ?.searchTerm;
      return ag && term ? `${ag}~${term}` : null;
    },
  });
  return applyCounted(rows, counted, (r) => `${r.adGroupId}~${r.searchTerm}`);
}

/** Period-level search lost impression share (rank + budget). Not date-summable. */
export type AdsCampaignShareRow = {
  campaignId: string;
  campaign: string;
  /** Search lost IS (rank) 0–1 */
  rankLostIs: number | null;
  rankLostTopIs: number | null;
  rankLostAbsTopIs: number | null;
  /** Search lost IS (budget) 0–1 */
  budgetLostIs: number | null;
  budgetLostTopIs: number | null;
  budgetLostAbsTopIs: number | null;
};

function parseShare(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Campaign search lost impression share for the date range (aggregated).
 * Search network only — Display / PMax often return null.
 */
export async function fetchAdsCampaignLostShare(opts: {
  customerId: string;
  from: string;
  to: string;
}): Promise<AdsCampaignShareRow[]> {
  const customerId = opts.customerId.replace(/-/g, "");
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      metrics.search_rank_lost_impression_share,
      metrics.search_rank_lost_top_impression_share,
      metrics.search_rank_lost_absolute_top_impression_share,
      metrics.search_budget_lost_impression_share,
      metrics.search_budget_lost_top_impression_share,
      metrics.search_budget_lost_absolute_top_impression_share,
      metrics.cost_micros
    FROM campaign
    WHERE segments.date BETWEEN '${opts.from}' AND '${opts.to}'
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
  `;

  const { json } = await adsSearch({ customerId, query });

  return ((json.results ?? []) as Array<{
    campaign?: { id?: string; name?: string };
    metrics?: {
      searchRankLostImpressionShare?: number | string;
      searchRankLostTopImpressionShare?: number | string;
      searchRankLostAbsoluteTopImpressionShare?: number | string;
      searchBudgetLostImpressionShare?: number | string;
      searchBudgetLostTopImpressionShare?: number | string;
      searchBudgetLostAbsoluteTopImpressionShare?: number | string;
    };
  }>).map((row) => {
    const campaign = row.campaign?.name || "(unnamed)";
    const m = row.metrics;
    return {
      campaignId: row.campaign?.id || campaign,
      campaign,
      rankLostIs: parseShare(m?.searchRankLostImpressionShare),
      rankLostTopIs: parseShare(m?.searchRankLostTopImpressionShare),
      rankLostAbsTopIs: parseShare(m?.searchRankLostAbsoluteTopImpressionShare),
      budgetLostIs: parseShare(m?.searchBudgetLostImpressionShare),
      budgetLostTopIs: parseShare(m?.searchBudgetLostTopImpressionShare),
      budgetLostAbsTopIs: parseShare(
        m?.searchBudgetLostAbsoluteTopImpressionShare,
      ),
    };
  });
}

/** Staff diagnostic — listAccessibleCustomers + token scope check (no secrets). */
export async function diagnoseGoogleAdsAuth(): Promise<{
  ok: boolean;
  scopesHasAdwords: boolean;
  scopeCount: number;
  developerTokenSet: boolean;
  loginCustomerIdSet: boolean;
  loginCustomerIdSuffix: string | null;
  accessibleCount: number | null;
  mareenAccessible: boolean | null;
  error: string | null;
}> {
  const developerTokenSet = Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim(),
  );
  const loginRaw = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim() || "";
  const loginCustomerIdSet = Boolean(loginRaw);
  const loginId = loginRaw.replace(/-/g, "");
  const loginCustomerIdSuffix = loginId
    ? `…${loginId.slice(-4)}`
    : null;

  try {
    const accessToken = await getGoogleAccessToken();
    const hint = await adsAuthHint(accessToken);
    const scopesHasAdwords = /scopesHasAdwords=true/.test(hint);
    const scopeCountMatch = /scopeCount=(\d+)/.exec(hint);
    const scopeCount = scopeCountMatch ? Number(scopeCountMatch[1]) : 0;

    const developerToken = getGoogleAdsDeveloperToken();
    const res = await fetch(
      `${ADS_API}/customers:listAccessibleCustomers`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken,
        },
      },
    );
    const json = (await res.json()) as {
      resourceNames?: string[];
      error?: { message?: string; status?: string };
    };

    if (!res.ok) {
      return {
        ok: false,
        scopesHasAdwords,
        scopeCount,
        developerTokenSet,
        loginCustomerIdSet,
        loginCustomerIdSuffix,
        accessibleCount: null,
        mareenAccessible: null,
        error:
          json.error?.message ||
          `listAccessibleCustomers ${res.status} (${hint})`,
      };
    }

    const names = json.resourceNames ?? [];
    return {
      ok: true,
      scopesHasAdwords,
      scopeCount,
      developerTokenSet,
      loginCustomerIdSet,
      loginCustomerIdSuffix,
      accessibleCount: names.length,
      mareenAccessible: names.includes("customers/9557333129"),
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      scopesHasAdwords: false,
      scopeCount: 0,
      developerTokenSet,
      loginCustomerIdSet,
      loginCustomerIdSuffix,
      accessibleCount: null,
      mareenAccessible: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
