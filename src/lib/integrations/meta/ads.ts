import type { TenantType } from "@prisma/client";
import { iterateYmdRanges } from "@/lib/date/tr";
import { deriveMetaKpis } from "@/lib/integrations/meta/insights";
import { getMetaSystemUserToken } from "@/lib/integrations/tokens";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Ad-level daily insights: same chunk size as campaign insights. */
const META_AD_INSIGHTS_CHUNK_DAYS = 30;

export type MetaAdCreativeRow = {
  adId: string;
  adName: string;
  adsetId: string;
  adsetName: string;
  campaignId: string;
  campaignName: string;
  status: string;
  effectiveStatus: string;
  creativeId: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  permalinkUrl: string | null;
  linkUrl: string | null;
  objectType: string | null;
};

export type MetaAdInsightRow = {
  date: string;
  adId: string;
  adName: string;
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adsetName: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  actions: Record<string, number>;
  actionValues: Record<string, number>;
  conversions: number;
  convValue: number;
  cpa: number | null;
  roas: number | null;
};

function actId(metaAccountId: string): string {
  return metaAccountId.startsWith("act_")
    ? metaAccountId
    : `act_${metaAccountId}`;
}

function mapActions(
  raw: Array<{ action_type?: string; value?: string }> | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of raw ?? []) {
    if (!a.action_type) continue;
    out[a.action_type] = Number(a.value ?? 0);
  }
  return out;
}

type GraphCreative = {
  id?: string;
  name?: string;
  thumbnail_url?: string;
  image_url?: string;
  object_type?: string;
  link_url?: string;
  effective_object_story_id?: string;
  object_story_spec?: {
    link_data?: { link?: string; image_hash?: string };
    video_data?: { image_url?: string; video_id?: string };
    page_id?: string;
  };
};

type GraphAd = {
  id?: string;
  name?: string;
  status?: string;
  effective_status?: string;
  campaign_id?: string;
  adset_id?: string;
  campaign?: { id?: string; name?: string };
  adset?: { id?: string; name?: string };
  creative?: GraphCreative;
  preview_shareable_link?: string;
};

function extractLinkUrl(creative: GraphCreative | undefined): string | null {
  if (!creative) return null;
  if (creative.link_url) return creative.link_url;
  const link = creative.object_story_spec?.link_data?.link;
  if (link) return link;
  return null;
}

function extractPermalink(
  ad: GraphAd,
  creative: GraphCreative | undefined,
): string | null {
  if (ad.preview_shareable_link) return ad.preview_shareable_link;
  const storyId = creative?.effective_object_story_id;
  if (storyId) {
    // pageId_postId → facebook.com/{pageId}/posts/{postId}
    const parts = storyId.split("_");
    if (parts.length === 2 && parts[0] && parts[1]) {
      return `https://www.facebook.com/${parts[0]}/posts/${parts[1]}`;
    }
  }
  return null;
}

/**
 * Ads + creatives under the ad account (owned/client via BM token).
 * Does NOT include ads from other ad accounts that were never shared to this BM.
 */
export async function fetchMetaAdsWithCreatives(opts: {
  metaAccountId: string;
}): Promise<MetaAdCreativeRow[]> {
  const token = getMetaSystemUserToken();
  const account = actId(opts.metaAccountId);

  const fields = [
    "id",
    "name",
    "status",
    "effective_status",
    "campaign_id",
    "campaign{id,name}",
    "adset_id",
    "adset{id,name}",
    "preview_shareable_link",
    "creative{id,name,thumbnail_url,image_url,object_type,link_url,effective_object_story_id,object_story_spec}",
  ].join(",");

  const params = new URLSearchParams({
    access_token: token,
    fields,
    limit: "100",
  });

  const rows: MetaAdCreativeRow[] = [];
  let url: string | null = `${GRAPH}/${account}/ads?${params}`;

  while (url) {
    const res = await fetch(url);
    const json = (await res.json()) as {
      data?: GraphAd[];
      paging?: { next?: string };
      error?: { message?: string };
    };

    if (!res.ok || json.error) {
      throw new Error(
        json.error?.message || `Meta ads ${res.status} for ${account}`,
      );
    }

    for (const ad of json.data ?? []) {
      if (!ad.id) continue;
      const creative = ad.creative;
      rows.push({
        adId: ad.id,
        adName: ad.name || "(unnamed)",
        adsetId: ad.adset_id || ad.adset?.id || "",
        adsetName: ad.adset?.name || "",
        campaignId: ad.campaign_id || ad.campaign?.id || "",
        campaignName: ad.campaign?.name || "",
        status: ad.status || "",
        effectiveStatus: ad.effective_status || ad.status || "",
        creativeId: creative?.id || "",
        thumbnailUrl: creative?.thumbnail_url || null,
        imageUrl:
          creative?.image_url ||
          creative?.object_story_spec?.video_data?.image_url ||
          null,
        permalinkUrl: extractPermalink(ad, creative),
        linkUrl: extractLinkUrl(creative),
        objectType: creative?.object_type || null,
      });
    }

    url = json.paging?.next ?? null;
  }

  return rows;
}

/**
 * Paid ad-level insights for the lookback window (chunked).
 */
export async function fetchMetaAdInsights(opts: {
  metaAccountId: string;
  from: string;
  to: string;
  tenantType: TenantType;
}): Promise<MetaAdInsightRow[]> {
  const rows: MetaAdInsightRow[] = [];
  for (const range of iterateYmdRanges(
    opts.from,
    opts.to,
    META_AD_INSIGHTS_CHUNK_DAYS,
  )) {
    const chunk = await fetchMetaAdInsightsChunk({
      metaAccountId: opts.metaAccountId,
      from: range.from,
      to: range.to,
      tenantType: opts.tenantType,
    });
    rows.push(...chunk);
  }
  return rows;
}

async function fetchMetaAdInsightsChunk(opts: {
  metaAccountId: string;
  from: string;
  to: string;
  tenantType: TenantType;
}): Promise<MetaAdInsightRow[]> {
  const token = getMetaSystemUserToken();
  const account = actId(opts.metaAccountId);

  const fields = [
    "ad_id",
    "ad_name",
    "adset_id",
    "adset_name",
    "campaign_id",
    "campaign_name",
    "spend",
    "impressions",
    "reach",
    "clicks",
    "ctr",
    "cpc",
    "actions",
    "action_values",
  ].join(",");

  const params = new URLSearchParams({
    access_token: token,
    level: "ad",
    time_increment: "1",
    time_range: JSON.stringify({ since: opts.from, until: opts.to }),
    fields,
    limit: "500",
  });

  const rows: MetaAdInsightRow[] = [];
  let url: string | null = `${GRAPH}/${account}/insights?${params}`;

  while (url) {
    const res = await fetch(url);
    const json = (await res.json()) as {
      data?: Array<{
        date_start?: string;
        ad_id?: string;
        ad_name?: string;
        adset_id?: string;
        adset_name?: string;
        campaign_id?: string;
        campaign_name?: string;
        spend?: string;
        impressions?: string;
        reach?: string;
        clicks?: string;
        ctr?: string;
        cpc?: string;
        actions?: Array<{ action_type?: string; value?: string }>;
        action_values?: Array<{ action_type?: string; value?: string }>;
      }>;
      paging?: { next?: string };
      error?: { message?: string };
    };

    if (!res.ok || json.error) {
      throw new Error(
        json.error?.message ||
          `Meta ad insights ${res.status} for ${account} (${opts.from}…${opts.to})`,
      );
    }

    for (const row of json.data ?? []) {
      if (!row.ad_id) continue;
      const spend = Number(row.spend ?? 0);
      const actions = mapActions(row.actions);
      const actionValues = mapActions(row.action_values);
      const kpis = deriveMetaKpis(opts.tenantType, actions, actionValues, spend);

      rows.push({
        date: row.date_start || opts.from,
        adId: row.ad_id,
        adName: row.ad_name || "(unnamed)",
        campaignId: row.campaign_id || "",
        campaignName: row.campaign_name || "",
        adsetId: row.adset_id || "",
        adsetName: row.adset_name || "",
        spend,
        impressions: Number(row.impressions ?? 0),
        reach: Number(row.reach ?? 0),
        clicks: Number(row.clicks ?? 0),
        ctr: row.ctr != null ? Number(row.ctr) : null,
        cpc: row.cpc != null ? Number(row.cpc) : null,
        actions,
        actionValues,
        conversions: kpis.conversions,
        convValue: kpis.convValue,
        cpa: kpis.cpa,
        roas: kpis.roas,
      });
    }

    url = json.paging?.next ?? null;
  }

  return rows;
}
