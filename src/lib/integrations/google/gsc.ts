import { getGoogleAccessToken } from "@/lib/integrations/tokens";

export type GscRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export async function fetchSearchConsoleQuery(opts: {
  siteUrl: string;
  from: string;
  to: string;
  dimensions?: string[];
  rowLimit?: number;
}): Promise<GscRow[]> {
  const accessToken = await getGoogleAccessToken();
  const site = encodeURIComponent(opts.siteUrl);

  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: opts.from,
        endDate: opts.to,
        dimensions: opts.dimensions ?? ["query"],
        rowLimit: opts.rowLimit ?? 25,
      }),
    },
  );

  const json = (await res.json()) as {
    rows?: Array<{
      keys?: string[];
      clicks?: number;
      impressions?: number;
      ctr?: number;
      position?: number;
    }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(json.error?.message || `Search Console ${res.status}`);
  }

  return (json.rows ?? []).map((r) => ({
    keys: r.keys ?? [],
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
}
