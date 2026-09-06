import { getGoogleAccessToken } from "@/lib/integrations/tokens";

export type Ga4OverviewMetrics = {
  totalUsers: number;
  sessions: number;
  averageSessionDuration: number;
  bounceRate: number;
  screenPageViewsPerSession: number;
  sessionConversionRate: number;
  purchaseRevenue: number | null;
  transactions: number | null;
};

export type Ga4DimensionRow = {
  dimension: string;
  sessions: number;
  users: number;
  conversions: number;
};

export type Ga4Snapshot = {
  overview: Ga4OverviewMetrics;
  channels: Ga4DimensionRow[];
  landings: Ga4DimensionRow[];
};

function propertyPath(propertyId: string): string {
  return propertyId.startsWith("properties/")
    ? propertyId
    : `properties/${propertyId}`;
}

async function runReport(opts: {
  property: string;
  accessToken: string;
  from: string;
  to: string;
  dimensions?: { name: string }[];
  metrics: { name: string }[];
  limit?: number;
}): Promise<
  Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>
> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/${opts.property}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: opts.from, endDate: opts.to }],
        dimensions: opts.dimensions,
        metrics: opts.metrics,
        limit: opts.limit ?? 50,
      }),
    },
  );

  const json = (await res.json()) as {
    rows?: Array<{
      dimensionValues?: Array<{ value?: string }>;
      metricValues?: Array<{ value?: string }>;
    }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(json.error?.message || `GA4 runReport ${res.status}`);
  }

  return json.rows ?? [];
}

/**
 * Full GA4 snapshot for panel: overview + channel + landing.
 * Throws on API/auth failure — never invent zeros for the caller to persist.
 */
export async function fetchGa4Snapshot(opts: {
  propertyId: string;
  from: string;
  to: string;
  ecommerce?: boolean;
}): Promise<Ga4Snapshot> {
  const accessToken = await getGoogleAccessToken();
  const property = propertyPath(opts.propertyId);

  const overviewMetrics = [
    { name: "totalUsers" },
    { name: "sessions" },
    { name: "averageSessionDuration" },
    { name: "bounceRate" },
    { name: "screenPageViewsPerSession" },
    { name: "sessionConversionRate" },
  ];
  if (opts.ecommerce) {
    overviewMetrics.push(
      { name: "purchaseRevenue" },
      { name: "transactions" },
    );
  }

  const [overviewRows, channelRows, landingRows] = await Promise.all([
    runReport({
      property,
      accessToken,
      from: opts.from,
      to: opts.to,
      metrics: overviewMetrics,
      limit: 1,
    }),
    runReport({
      property,
      accessToken,
      from: opts.from,
      to: opts.to,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "conversions" },
      ],
      limit: 25,
    }),
    runReport({
      property,
      accessToken,
      from: opts.from,
      to: opts.to,
      dimensions: [{ name: "landingPagePlusQueryString" }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "conversions" },
      ],
      limit: 25,
    }),
  ]);

  const ov = overviewRows[0]?.metricValues ?? [];
  const overview: Ga4OverviewMetrics = {
    totalUsers: Number(ov[0]?.value ?? 0),
    sessions: Number(ov[1]?.value ?? 0),
    averageSessionDuration: Number(ov[2]?.value ?? 0),
    bounceRate: Number(ov[3]?.value ?? 0),
    screenPageViewsPerSession: Number(ov[4]?.value ?? 0),
    sessionConversionRate: Number(ov[5]?.value ?? 0),
    purchaseRevenue: opts.ecommerce ? Number(ov[6]?.value ?? 0) : null,
    transactions: opts.ecommerce ? Number(ov[7]?.value ?? 0) : null,
  };

  const mapDim = (
    rows: typeof channelRows,
  ): Ga4DimensionRow[] =>
    rows.map((row) => ({
      dimension: row.dimensionValues?.[0]?.value || "(not set)",
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
      users: Number(row.metricValues?.[1]?.value ?? 0),
      conversions: Number(row.metricValues?.[2]?.value ?? 0),
    }));

  return {
    overview,
    channels: mapDim(channelRows),
    landings: mapDim(landingRows),
  };
}

/** @deprecated use fetchGa4Snapshot */
export async function fetchGa4Overview(opts: {
  propertyId: string;
  from: string;
  to: string;
}): Promise<Array<{ channel: string; sessions: number; conversions: number }>> {
  const snap = await fetchGa4Snapshot(opts);
  return snap.channels.map((c) => ({
    channel: c.dimension,
    sessions: c.sessions,
    conversions: c.conversions,
  }));
}
