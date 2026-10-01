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
  /** Toplam anahtar etkinlik (eski adıyla "conversions"). */
  keyEvents?: number;
  ecommercePurchases?: number | null;
};

/** eventName → anahtar etkinlik adedi (hangi olaylar dönüşüm sayılıyor). */
export type Ga4KeyEventRow = { eventName: string; keyEvents: number };

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
  keyEventsByName: Ga4KeyEventRow[];
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
  offset?: number;
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
        ...(opts.offset ? { offset: opts.offset } : {}),
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
    // GA4: "conversions" → "keyEvents", "sessionConversionRate" → "sessionKeyEventRate"
    { name: "sessionKeyEventRate" },
    { name: "keyEvents" },
  ];
  if (opts.ecommerce) {
    overviewMetrics.push(
      { name: "purchaseRevenue" },
      { name: "transactions" },
      { name: "ecommercePurchases" },
    );
  }

  const [overviewRows, channelRows, landingRows, keyEventRows] = await Promise.all([
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
        { name: "keyEvents" },
      ],
      limit: 50,
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
        { name: "keyEvents" },
      ],
      limit: 25,
    }),
    runReport({
      property,
      accessToken,
      from: opts.from,
      to: opts.to,
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "keyEvents" }],
      limit: 50,
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
    keyEvents: Number(ov[6]?.value ?? 0),
    purchaseRevenue: opts.ecommerce ? Number(ov[7]?.value ?? 0) : null,
    transactions: opts.ecommerce ? Number(ov[8]?.value ?? 0) : null,
    ecommercePurchases: opts.ecommerce ? Number(ov[9]?.value ?? 0) : null,
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
    keyEventsByName: keyEventRows
      .map((row) => ({
        eventName: row.dimensionValues?.[0]?.value || "(not set)",
        keyEvents: Number(row.metricValues?.[0]?.value ?? 0),
      }))
      .filter((r) => r.keyEvents > 0)
      .sort((a, b) => b.keyEvents - a.keyEvents),
  };
}

export type Ga4DailyOverviewRow = {
  date: string;
  totalUsers: number;
  sessions: number;
  averageSessionDuration: number;
  bounceRate: number;
  screenPageViewsPerSession: number;
  sessionKeyEventRate: number;
  purchaseRevenue: number | null;
  transactions: number | null;
  ecommercePurchases: number | null;
};

export type Ga4DailyChannelRow = {
  date: string;
  channel: string;
  sessions: number;
  users: number;
  keyEvents: number;
};

const GA4_PAGE = 100_000;

/** runReport'u offset ile sonuna kadar çek. */
async function runReportAll(
  opts: Omit<Parameters<typeof runReport>[0], "limit" | "offset">,
) {
  const all: Awaited<ReturnType<typeof runReport>> = [];
  for (let offset = 0; ; offset += GA4_PAGE) {
    const rows = await runReport({ ...opts, limit: GA4_PAGE, offset });
    all.push(...rows);
    if (rows.length < GA4_PAGE) break;
  }
  return all;
}

/** GA4 "YYYYMMDD" → "YYYY-MM-DD" */
function ga4Ymd(v: string | undefined): string {
  const s = v ?? "";
  return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s;
}

/**
 * Günlük GA4 (DB için): genel bakış × gün + kanal × gün.
 * Dönem filtresi DB'de bu satırlardan toplanır (oranlar oturum ağırlıklı).
 */
export async function fetchGa4Daily(opts: {
  propertyId: string;
  from: string;
  to: string;
  ecommerce?: boolean;
}): Promise<{ overview: Ga4DailyOverviewRow[]; channels: Ga4DailyChannelRow[] }> {
  const accessToken = await getGoogleAccessToken();
  const property = propertyPath(opts.propertyId);

  const overviewMetrics = [
    { name: "totalUsers" },
    { name: "sessions" },
    { name: "averageSessionDuration" },
    { name: "bounceRate" },
    { name: "screenPageViewsPerSession" },
    { name: "sessionKeyEventRate" },
  ];
  if (opts.ecommerce) {
    overviewMetrics.push(
      { name: "purchaseRevenue" },
      { name: "transactions" },
      { name: "ecommercePurchases" },
    );
  }

  const [ovRows, chRows] = await Promise.all([
    runReportAll({
      property,
      accessToken,
      from: opts.from,
      to: opts.to,
      dimensions: [{ name: "date" }],
      metrics: overviewMetrics,
    }),
    runReportAll({
      property,
      accessToken,
      from: opts.from,
      to: opts.to,
      dimensions: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "keyEvents" },
      ],
    }),
  ]);

  const num = (
    row: (typeof ovRows)[number],
    i: number,
  ): number => Number(row.metricValues?.[i]?.value ?? 0);

  return {
    overview: ovRows.map((row) => ({
      date: ga4Ymd(row.dimensionValues?.[0]?.value),
      totalUsers: num(row, 0),
      sessions: num(row, 1),
      averageSessionDuration: num(row, 2),
      bounceRate: num(row, 3),
      screenPageViewsPerSession: num(row, 4),
      sessionKeyEventRate: num(row, 5),
      purchaseRevenue: opts.ecommerce ? num(row, 6) : null,
      transactions: opts.ecommerce ? num(row, 7) : null,
      ecommercePurchases: opts.ecommerce ? num(row, 8) : null,
    })),
    channels: chRows.map((row) => ({
      date: ga4Ymd(row.dimensionValues?.[0]?.value),
      channel: row.dimensionValues?.[1]?.value || "(not set)",
      sessions: num(row, 0),
      users: num(row, 1),
      keyEvents: num(row, 2),
    })),
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
