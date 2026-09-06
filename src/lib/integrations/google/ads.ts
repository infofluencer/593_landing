import {
  getGoogleAccessToken,
  getGoogleAdsDeveloperToken,
  getGoogleAdsLoginCustomerId,
} from "@/lib/integrations/tokens";

const ADS_API = "https://googleads.googleapis.com/v18";

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

/**
 * GAQL read via Google Ads API search (login-customer-id = MCC).
 * Never invents zeros on auth/API failure — caller must record SyncJob.error.
 */
export async function fetchGoogleAdsCampaignMetrics(opts: {
  customerId: string;
  from: string; // YYYY-MM-DD
  to: string;
}): Promise<AdsCampaignRow[]> {
  const accessToken = await getGoogleAccessToken();
  const developerToken = getGoogleAdsDeveloperToken();
  const loginCustomerId = getGoogleAdsLoginCustomerId();
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
      body: JSON.stringify({ query }),
    },
  );

  const json = (await res.json()) as {
    results?: Array<{
      campaign?: { id?: string; name?: string };
      segments?: { date?: string };
      metrics?: {
        costMicros?: string;
        impressions?: string;
        clicks?: string;
        conversions?: number;
        conversionsValue?: number;
      };
    }>;
    error?: { message?: string; status?: string };
  };

  if (!res.ok) {
    throw new Error(
      json.error?.message ||
        `Google Ads API ${res.status} for customer ${customerId}`,
    );
  }

  return (json.results ?? []).map((row) => {
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
  const accessToken = await getGoogleAccessToken();
  const developerToken = getGoogleAdsDeveloperToken();
  const loginCustomerId = getGoogleAdsLoginCustomerId();
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
      body: JSON.stringify({ query }),
    },
  );

  const json = (await res.json()) as {
    results?: Array<{
      segments?: {
        conversionActionName?: string;
        conversionActionCategory?: string;
      };
      metrics?: { conversions?: number; allConversions?: number };
    }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(
      json.error?.message ||
        `Google Ads conversions ${res.status} for ${customerId}`,
    );
  }

  const byName = new Map<string, AdsConversionAction>();
  for (const row of json.results ?? []) {
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
