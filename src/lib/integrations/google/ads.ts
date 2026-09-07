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
