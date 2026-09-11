import {
  getGoogleAccessToken,
  getGoogleAdsDeveloperToken,
  getGoogleAdsLoginCustomerId,
} from "@/lib/integrations/tokens";

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
}): Promise<{ res: Response; json: AdsErrorJson & { results?: unknown[] } }> {
  const accessToken = await getGoogleAccessToken();
  const developerToken = getGoogleAdsDeveloperToken();
  const loginCustomerId = getGoogleAdsLoginCustomerId();
  const customerId = opts.customerId.replace(/-/g, "");

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
      body: JSON.stringify({ query: opts.query }),
    },
  );

  const json = (await res.json()) as AdsErrorJson & { results?: unknown[] };
  if (!res.ok) {
    const hint = await adsAuthHint(accessToken);
    throw formatAdsHttpError(res, json, customerId, hint);
  }
  return { res, json };
}

/**
 * GAQL read via Google Ads API search (login-customer-id = MCC).
 * Never invents zeros on auth/API failure — caller must record SyncJob.error.
 */
export async function fetchGoogleAdsCampaignMetrics(opts: {
  customerId: string;
  from: string; // YYYY-MM-DD
  to: string;
}): Promise<AdsCampaignRow[]> {
  const customerId = opts.customerId.replace(/-/g, "");
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      segments.date,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${opts.from}' AND '${opts.to}'
      AND campaign.status != 'REMOVED'
  `;

  const { json } = await adsSearch({ customerId, query });

  return ((json.results ?? []) as Array<{
    campaign?: { id?: string; name?: string };
    segments?: { date?: string };
    metrics?: {
      costMicros?: string;
      impressions?: string;
      clicks?: string;
      conversions?: number;
      conversionsValue?: number;
    };
  }>).map((row) => {
    const spend = microsToCurrency(row.metrics?.costMicros ?? 0);
    const convValue = Number(row.metrics?.conversionsValue ?? 0);
    const name = row.campaign?.name || "(unnamed)";
    return {
      campaignId: row.campaign?.id || name,
      campaign: name,
      date: row.segments?.date || opts.from,
      spend,
      impr: Number(row.metrics?.impressions ?? 0),
      clicks: Number(row.metrics?.clicks ?? 0),
      conv: Number(row.metrics?.conversions ?? 0),
      convValue,
    };
  });
}

export type AdsConversionAction = {
  name: string;
  source: string;
  primary: boolean;
  count: number;
};

export async function fetchGoogleAdsConversionActions(opts: {
  customerId: string;
  from: string;
  to: string;
}): Promise<AdsConversionAction[]> {
  const customerId = opts.customerId.replace(/-/g, "");
  const query = `
    SELECT
      segments.conversion_action_name,
      segments.conversion_action_category,
      metrics.conversions,
      metrics.all_conversions
    FROM customer
    WHERE segments.date BETWEEN '${opts.from}' AND '${opts.to}'
  `;

  const { json } = await adsSearch({ customerId, query });

  const byName = new Map<string, AdsConversionAction>();
  for (const row of (json.results ?? []) as Array<{
    segments?: {
      conversionActionName?: string;
      conversionActionCategory?: string;
    };
    metrics?: { conversions?: number; allConversions?: number };
  }>) {
    const name = row.segments?.conversionActionName || "Unknown";
    const count = Number(row.metrics?.conversions ?? 0);
    const prev = byName.get(name);
    if (prev) {
      prev.count += count;
    } else {
      byName.set(name, {
        name,
        source: "Google Ads",
        primary: true,
        count,
      });
    }
  }
  return [...byName.values()];
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

  return ((json.results ?? []) as Array<{
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
}

/** Active-campaign keywords (keyword_view), top 50 by spend. */
export async function fetchAdsKeywords(opts: {
  customerId: string;
  from: string;
  to: string;
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

  return ((json.results ?? []) as Array<{
    campaign?: { id?: string; name?: string };
    adGroup?: { id?: string; name?: string };
    adGroupCriterion?: {
      keyword?: { text?: string; matchType?: string };
    };
    metrics?: MetricsFields;
  }>).map((row) => {
    const campaign = row.campaign?.name || "(kampanya)";
    const adGroup = row.adGroup?.name || "(grup)";
    const keyword = row.adGroupCriterion?.keyword?.text || "(kelime)";
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
}

/** Active-campaign search terms, top 50 by spend. Search campaigns only. */
export async function fetchAdsSearchTerms(opts: {
  customerId: string;
  from: string;
  to: string;
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

  return ((json.results ?? []) as Array<{
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
      metrics.search_budget_lost_absolute_top_impression_share
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
