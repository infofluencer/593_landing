import type { TenantType } from "@prisma/client";
import { iterateYmdRanges } from "@/lib/date/tr";
import {
  META_INSIGHT_BASE_FIELDS,
  deriveMetaLeadParts,
  deriveMetaPurchase,
  mapActions,
  mergeVideoActions,
} from "@/lib/integrations/meta/metrics";
import { getMetaSystemUserToken } from "@/lib/integrations/tokens";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Daily campaign insights: keep each Graph call small (720g lookback → ~24 calls). */
const META_INSIGHTS_CHUNK_DAYS = 30;

export type MetaInsightRow = {
  date: string;
  campaignId: string;
  campaignName: string;
  objective: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number | null;
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

/**
 * Tenant.type → primary KPI from Meta actions / action_values.
 * ecommerce: purchase (+ value/ROAS). lead: form lead + messaging conversations.
 */
export function deriveMetaKpis(
  type: TenantType,
  actions: Record<string, number>,
  actionValues: Record<string, number>,
  spend: number,
): { conversions: number; convValue: number; cpa: number | null; roas: number | null } {
  if (type === "ecommerce") {
    const { count: conversions, value: convValue } = deriveMetaPurchase(
      actions,
      actionValues,
    );
    return {
      conversions,
      convValue,
      cpa: conversions > 0 ? spend / conversions : null,
      roas: spend > 0 && convValue > 0 ? convValue / spend : null,
    };
  }

  // Lead = form lead + başlayan mesajlaşma (ikisi ayrı olaylar, örtüşmez).
  const { form, messaging } = deriveMetaLeadParts(actions);
  const conversions = form + messaging;
  return {
    conversions,
    convValue: 0,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: null,
  };
}

/**
 * Paid campaign insights only (no Instagram organic).
 * Pulls `from`→`to` in META_INSIGHTS_CHUNK_DAYS windows (Google-style long history,
 * Meta-safe request size). Failures throw — caller must not invent zeros.
 */
export async function fetchMetaCampaignInsights(opts: {
  metaAccountId: string;
  from: string;
  to: string;
  tenantType: TenantType;
}): Promise<MetaInsightRow[]> {
  const rows: MetaInsightRow[] = [];
  for (const range of iterateYmdRanges(
    opts.from,
    opts.to,
    META_INSIGHTS_CHUNK_DAYS,
  )) {
    const chunk = await fetchMetaCampaignInsightsChunk({
      metaAccountId: opts.metaAccountId,
      from: range.from,
      to: range.to,
      tenantType: opts.tenantType,
    });
    rows.push(...chunk);
  }
  return rows;
}

async function fetchMetaCampaignInsightsChunk(opts: {
  metaAccountId: string;
  from: string;
  to: string;
  tenantType: TenantType;
}): Promise<MetaInsightRow[]> {
  const token = getMetaSystemUserToken();
  const account = actId(opts.metaAccountId);

  const fields = [
    "campaign_id",
    "campaign_name",
    "objective",
    ...META_INSIGHT_BASE_FIELDS,
  ].join(",");

  const params = new URLSearchParams({
    access_token: token,
    level: "campaign",
    time_increment: "1",
    // Ads Manager ile aynı: reklam setinin kendi atıf ayarı (varsayılan 7g tık / 1g görüntüleme değil)
    use_unified_attribution_setting: "true",
    time_range: JSON.stringify({ since: opts.from, until: opts.to }),
    fields,
    limit: "500",
  });

  const rows: MetaInsightRow[] = [];
  let url: string | null = `${GRAPH}/${account}/insights?${params}`;

  while (url) {
    const res = await fetch(url);
    const json = (await res.json()) as {
      data?: Array<{
        date_start?: string;
        campaign_id?: string;
        campaign_name?: string;
        objective?: string;
        spend?: string;
        impressions?: string;
        reach?: string;
        frequency?: string;
        clicks?: string;
        ctr?: string;
        cpc?: string;
        actions?: Array<{ action_type?: string; value?: string }>;
        action_values?: Array<{ action_type?: string; value?: string }>;
        video_play_actions?: Array<{ action_type?: string; value?: string }>;
        video_thruplay_watched_actions?: Array<{
          action_type?: string;
          value?: string;
        }>;
        video_p25_watched_actions?: Array<{
          action_type?: string;
          value?: string;
        }>;
        video_p50_watched_actions?: Array<{
          action_type?: string;
          value?: string;
        }>;
        video_p75_watched_actions?: Array<{
          action_type?: string;
          value?: string;
        }>;
        video_p100_watched_actions?: Array<{
          action_type?: string;
          value?: string;
        }>;
      }>;
      paging?: { next?: string };
      error?: { message?: string; code?: number; error_subcode?: number };
    };

    if (!res.ok || json.error) {
      throw new Error(
        json.error?.message ||
          `Meta insights ${res.status} for ${account} (${opts.from}…${opts.to})`,
      );
    }

    for (const row of json.data ?? []) {
      const spend = Number(row.spend ?? 0);
      const actions = mergeVideoActions(mapActions(row.actions), row);
      const actionValues = mapActions(row.action_values);
      const kpis = deriveMetaKpis(opts.tenantType, actions, actionValues, spend);

      rows.push({
        date: row.date_start || opts.from,
        campaignId: row.campaign_id || "",
        campaignName: row.campaign_name || "(unnamed)",
        objective: row.objective || "",
        spend,
        impressions: Number(row.impressions ?? 0),
        reach: Number(row.reach ?? 0),
        frequency: row.frequency != null ? Number(row.frequency) : null,
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

/**
 * Dönem tekil erişimi (time_increment yok → Meta tekilleştirir).
 * Günlük erişimleri toplamak aynı kişiyi her gün yeniden sayar.
 */
export async function fetchMetaPeriodReach(opts: {
  metaAccountId: string;
  from: string;
  to: string;
}): Promise<{
  account: { reach: number; frequency: number | null } | null;
  byCampaign: Map<string, { reach: number; frequency: number | null }>;
}> {
  const token = getMetaSystemUserToken();
  const account = actId(opts.metaAccountId);

  async function pull(level: "account" | "campaign") {
    const params = new URLSearchParams({
      access_token: token,
      level,
      use_unified_attribution_setting: "true",
      time_range: JSON.stringify({ since: opts.from, until: opts.to }),
      fields:
        level === "campaign" ? "campaign_id,reach,frequency" : "reach,frequency",
      limit: "500",
    });
    const out: Array<{ campaign_id?: string; reach?: string; frequency?: string }> = [];
    let url: string | null = `${GRAPH}/${account}/insights?${params}`;
    while (url) {
      const res = await fetch(url);
      const json = (await res.json()) as {
        data?: Array<{ campaign_id?: string; reach?: string; frequency?: string }>;
        paging?: { next?: string };
        error?: { message?: string };
      };
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || `Meta reach ${res.status}`);
      }
      out.push(...(json.data ?? []));
      url = json.paging?.next ?? null;
    }
    return out;
  }

  const [acc, camps] = await Promise.all([pull("account"), pull("campaign")]);
  const parse = (r: { reach?: string; frequency?: string }) => ({
    reach: Number(r.reach ?? 0),
    frequency: r.frequency != null ? Number(r.frequency) : null,
  });
  const byCampaign = new Map<string, { reach: number; frequency: number | null }>();
  for (const r of camps) {
    if (r.campaign_id) byCampaign.set(r.campaign_id, parse(r));
  }
  return { account: acc[0] ? parse(acc[0]) : null, byCampaign };
}
