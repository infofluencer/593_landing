import { getMetaSystemUserToken } from "@/lib/integrations/tokens";

const GRAPH = "https://graph.facebook.com/v21.0";

export type MetaBillingCharge = {
  externalId: string;
  amount: number;
  currency: string;
  chargedAt: Date;
  viewUrl: string;
  status: "completed";
};

type ActivityRow = {
  event_time?: string;
  event_type?: string;
  extra_data?: string;
};

type GraphPage<T> = {
  data?: T[];
  paging?: { next?: string };
  error?: { message: string; code?: number };
};

function actId(metaAccountId: string): string {
  return metaAccountId.startsWith("act_")
    ? metaAccountId
    : `act_${metaAccountId}`;
}

/** www.facebook.com/ads/receipt → 404; Business Suite receipt hâlâ açılıyor. */
export function metaReceiptViewUrl(transactionId: string): string {
  return `https://business.facebook.com/ads/receipt/?transaction_id=${encodeURIComponent(transactionId)}`;
}

/** Eski www receipt URL’lerini Business Suite’e çevir (DB’de kalanlar için). */
export function normalizeMetaViewUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const m = /(?:www\.)?facebook\.com\/ads\/receipt\/?\?(?:.*&)?transaction_id=([^&]+)/i.exec(
    url,
  );
  if (m?.[1]) {
    return metaReceiptViewUrl(decodeURIComponent(m[1]));
  }
  return url;
}

function ymdToUnixStart(ymd: string): number {
  return Math.floor(new Date(`${ymd}T00:00:00+03:00`).getTime() / 1000);
}

function ymdToUnixEnd(ymd: string): number {
  return Math.floor(new Date(`${ymd}T23:59:59+03:00`).getTime() / 1000);
}

async function graphGet<T>(url: string): Promise<GraphPage<T>> {
  const res = await fetch(url, { method: "GET" });
  const json = (await res.json()) as GraphPage<T>;
  if (!res.ok || json.error) {
    throw new Error(
      json.error?.message || `Meta Graph error ${res.status} on activities`,
    );
  }
  return json;
}

/**
 * Successful Meta Ads auto-payment charges (Billing → Transactions).
 * Source: act_{id}/activities where event_type = ad_account_billing_charge.
 */
export async function fetchMetaSuccessfulCharges(opts: {
  metaAccountId: string;
  from: string;
  to: string;
}): Promise<MetaBillingCharge[]> {
  const token = getMetaSystemUserToken();
  const id = actId(opts.metaAccountId);
  const since = ymdToUnixStart(opts.from);
  const until = ymdToUnixEnd(opts.to);
  const fields = "event_time,event_type,extra_data";

  let next: string | null =
    `${GRAPH}/${id}/activities?fields=${encodeURIComponent(fields)}` +
    `&since=${since}&until=${until}&limit=100` +
    `&access_token=${encodeURIComponent(token)}`;

  const out: MetaBillingCharge[] = [];
  const seen = new Set<string>();

  while (next) {
    const page: GraphPage<ActivityRow> = await graphGet<ActivityRow>(next);
    for (const row of page.data ?? []) {
      if (row.event_type !== "ad_account_billing_charge") continue;
      let extra: {
        currency?: string;
        new_value?: number | string;
        transaction_id?: string;
        type?: string;
      } = {};
      try {
        extra = JSON.parse(row.extra_data || "{}") as typeof extra;
      } catch {
        continue;
      }
      // payment_amount = successful card charge
      if (extra.type && extra.type !== "payment_amount") continue;
      const tx = extra.transaction_id?.trim();
      if (!tx || seen.has(tx)) continue;
      const minor = Number(extra.new_value);
      if (!Number.isFinite(minor) || minor <= 0) continue;
      const chargedAt = row.event_time ? new Date(row.event_time) : null;
      if (!chargedAt || Number.isNaN(chargedAt.getTime())) continue;

      seen.add(tx);
      out.push({
        externalId: tx,
        amount: minor / 100,
        currency: (extra.currency || "TRY").toUpperCase(),
        chargedAt,
        viewUrl: metaReceiptViewUrl(tx),
        status: "completed",
      });
    }
    next = page.paging?.next ?? null;
  }

  out.sort((a, b) => b.chargedAt.getTime() - a.chargedAt.getTime());
  return out;
}
