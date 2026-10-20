import { getMetaSystemUserToken } from "@/lib/integrations/tokens";
import { graphFetch } from "@/lib/integrations/meta/graph";

const GRAPH = "https://graph.facebook.com/v21.0";

function actId(metaAccountId: string): string {
  return metaAccountId.startsWith("act_") ? metaAccountId : `act_${metaAccountId}`;
}

export type HourlyRow = {
  hour: number;
  spend: number;
  impressions: number;
  clicks: number;
};

/**
 * Hesap seviyesi tek gün, saat kırılımı (reklamveren saat dilimi).
 * Meta saatlik veriyi birkaç dakika gecikmeyle doldurur.
 */
export async function fetchMetaHourlySpend(opts: {
  metaAccountId: string;
  date: string;
}): Promise<HourlyRow[]> {
  const params = new URLSearchParams({
    access_token: getMetaSystemUserToken(),
    level: "account",
    time_range: JSON.stringify({ since: opts.date, until: opts.date }),
    breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone",
    fields: "spend,impressions,clicks",
    limit: "100",
  });
  const { res, json: rawJson } = await graphFetch(`${GRAPH}/${actId(opts.metaAccountId)}/insights?${params}`);
  const json = rawJson as {
    data?: Array<{
      hourly_stats_aggregated_by_advertiser_time_zone?: string;
      spend?: string;
      impressions?: string;
      clicks?: string;
    }>;
    error?: { message?: string; code?: number };
  };
  if (!res.ok || json.error) {
    const code = json.error?.code != null ? ` (#${json.error.code})` : "";
    throw new Error(`${json.error?.message ?? `Meta HTTP ${res.status}`}${code}`);
  }
  return (json.data ?? [])
    .map((r) => ({
      // "13:00:00 - 13:59:59"
      hour: Number((r.hourly_stats_aggregated_by_advertiser_time_zone ?? "").slice(0, 2)),
      spend: Number(r.spend ?? 0),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
    }))
    .filter((r) => Number.isInteger(r.hour) && r.hour >= 0 && r.hour <= 23);
}

/** https://developers.facebook.com/docs/marketing-api/reference/ad-account/ */
const ACCOUNT_STATUS: Record<number, { label: string; level: "ok" | "warn" | "critical" }> = {
  1: { label: "Aktif", level: "ok" },
  2: { label: "Hesap devre dışı", level: "critical" },
  3: { label: "Ödenmemiş bakiye", level: "critical" },
  7: { label: "Risk incelemesinde", level: "warn" },
  8: { label: "Ödeme mutabakatı bekliyor", level: "warn" },
  9: { label: "Ödeme ek süresinde", level: "critical" },
  100: { label: "Kapanma sürecinde", level: "critical" },
  101: { label: "Hesap kapalı", level: "critical" },
  201: { label: "Aktif", level: "ok" },
  202: { label: "Hesap kapalı", level: "critical" },
};

const DISABLE_REASON: Record<number, string> = {
  1: "Reklam politikası ihlali",
  2: "Fikri mülkiyet incelemesi",
  3: "Ödeme riski",
  4: "Hesap kapatıldı",
  5: "AFC incelemesi",
  6: "İşletme bütünlüğü incelemesi",
  7: "Kalıcı kapatma",
  8: "Kullanılmayan bayi hesabı",
  9: "Kullanılmayan hesap",
};

export type AccountHealthResult = {
  status: "ok" | "warn" | "critical" | "unknown";
  label: string;
  detail: string | null;
  raw: Record<string, unknown>;
};

/** Yayındaki kampanya sayısı (harcama yoksa sebep için); hata → null. */
async function countMetaActiveCampaigns(
  metaAccountId: string,
): Promise<number | null> {
  try {
    const params = new URLSearchParams({
      access_token: getMetaSystemUserToken(),
      fields: "id",
      effective_status: JSON.stringify(["ACTIVE"]),
      limit: "200",
    });
    const { res, json: rawJson } = await graphFetch(`${GRAPH}/${actId(metaAccountId)}/campaigns?${params}`);
    const json = rawJson as { data?: unknown[]; error?: unknown };
    if (!res.ok || json.error) return null;
    return json.data?.length ?? 0;
  } catch {
    return null;
  }
}

/** Reklam hesabı durumu — ödenmemiş / askıda / harcama limiti. */
export async function fetchMetaAccountHealth(
  metaAccountId: string,
): Promise<AccountHealthResult> {
  const params = new URLSearchParams({
    access_token: getMetaSystemUserToken(),
    fields: "account_status,disable_reason,spend_cap,amount_spent,balance,currency,is_prepay_account",
  });
  const { res, json: rawJson } = await graphFetch(`${GRAPH}/${actId(metaAccountId)}?${params}`);
  const json = rawJson as {
    account_status?: number;
    disable_reason?: number;
    spend_cap?: string;
    amount_spent?: string;
    balance?: string;
    currency?: string;
    is_prepay_account?: boolean;
    error?: { message?: string; code?: number };
  };
  if (!res.ok || json.error) {
    const code = json.error?.code != null ? ` (#${json.error.code})` : "";
    throw new Error(`${json.error?.message ?? `Meta HTTP ${res.status}`}${code}`);
  }

  const raw = {
    ...json,
    activeCampaigns: await countMetaActiveCampaigns(metaAccountId),
  } as Record<string, unknown>;
  const st = json.account_status != null ? ACCOUNT_STATUS[json.account_status] : undefined;
  const reason =
    json.disable_reason && json.disable_reason > 0
      ? DISABLE_REASON[json.disable_reason] ?? `Kod ${json.disable_reason}`
      : null;

  if (st && st.level !== "ok") {
    return {
      status: st.level,
      label: st.label,
      detail: reason,
      raw,
    };
  }

  // Hesap harcama limiti (Meta tutarları kuruş cinsinden döner).
  const cap = Number(json.spend_cap ?? 0);
  const spent = Number(json.amount_spent ?? 0);
  if (cap > 0) {
    const used = spent / cap;
    if (used >= 1) {
      return {
        status: "critical",
        label: "Harcama limiti doldu",
        detail: `Hesap harcama limitinin tamamı kullanıldı`,
        raw,
      };
    }
    if (used >= 0.9) {
      return {
        status: "warn",
        label: "Harcama limiti dolmak üzere",
        detail: `Limitin %${Math.round(used * 100)}'i kullanıldı`,
        raw,
      };
    }
  }

  return {
    status: st ? "ok" : "unknown",
    label: st?.label ?? "Bilinmiyor",
    detail: reason,
    raw,
  };
}
