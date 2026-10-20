import { adsSearch } from "@/lib/integrations/google/ads";
import type {
  AccountHealthResult,
  HourlyRow,
} from "@/lib/integrations/meta/hourly";

/** Hesap seviyesi tek gün, saat kırılımı (Google Ads hesap saat dilimi). */
export async function fetchGoogleHourlySpend(opts: {
  customerId: string;
  date: string;
}): Promise<HourlyRow[]> {
  const { json } = await adsSearch({
    customerId: opts.customerId,
    query: `SELECT segments.hour, metrics.cost_micros, metrics.impressions, metrics.clicks
            FROM customer
            WHERE segments.date = '${opts.date}'`,
  });
  const byHour = new Map<number, HourlyRow>();
  for (const raw of json.results ?? []) {
    const r = raw as {
      segments?: { hour?: number };
      metrics?: { costMicros?: string; impressions?: string; clicks?: string };
    };
    const hour = Number(r.segments?.hour ?? -1);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;
    const prev = byHour.get(hour) ?? { hour, spend: 0, impressions: 0, clicks: 0 };
    prev.spend += Number(r.metrics?.costMicros ?? 0) / 1_000_000;
    prev.impressions += Number(r.metrics?.impressions ?? 0);
    prev.clicks += Number(r.metrics?.clicks ?? 0);
    byHour.set(hour, prev);
  }
  return [...byHour.values()];
}

const CUSTOMER_STATUS: Record<string, string> = {
  CANCELED: "Hesap iptal edildi",
  SUSPENDED: "Hesap askıya alındı",
  CLOSED: "Hesap kapalı",
};

/**
 * Hesap + faturalama durumu: müşteri durumu, onaylı billing setup,
 * hesap bütçesi (limit doldu / süresi bitti).
 */
export async function fetchGoogleAccountHealth(
  customerId: string,
): Promise<AccountHealthResult> {
  const [customerRes, setupRes, budgetRes, campaignsRes] = await Promise.all([
    adsSearch({ customerId, query: "SELECT customer.status FROM customer LIMIT 1" }),
    adsSearch({ customerId, query: "SELECT billing_setup.status FROM billing_setup" }),
    adsSearch({
      customerId,
      query: `SELECT account_budget.status,
                     account_budget.approved_spending_limit_micros,
                     account_budget.approved_spending_limit_type,
                     account_budget.amount_served_micros,
                     account_budget.approved_end_date_time,
                     account_budget.approved_end_time_type
              FROM account_budget`,
    }),
    // Harcama yoksa sebep: "Aktif kampanya yok" — sorgu düşerse bilinmiyor kalır.
    adsSearch({
      customerId,
      query: "SELECT campaign.id FROM campaign WHERE campaign.status = 'ENABLED'",
    }).catch(() => null),
  ]);

  const status =
    (customerRes.json.results?.[0] as { customer?: { status?: string } } | undefined)
      ?.customer?.status ?? null;
  const setups = (setupRes.json.results ?? []).map(
    (r) => (r as { billingSetup?: { status?: string } }).billingSetup?.status ?? "",
  );
  const budgets = (budgetRes.json.results ?? []).map((r) => {
    const b = (r as {
      accountBudget?: {
        status?: string;
        approvedSpendingLimitMicros?: string;
        approvedSpendingLimitType?: string;
        amountServedMicros?: string;
        approvedEndDateTime?: string;
        approvedEndTimeType?: string;
      };
    }).accountBudget ?? {};
    return b;
  });
  const enabledCampaigns = campaignsRes
    ? (campaignsRes.json.results ?? []).length
    : null;
  const raw = {
    customerStatus: status,
    billingSetups: setups,
    accountBudgets: budgets,
    enabledCampaigns,
  };

  if (status && CUSTOMER_STATUS[status]) {
    return { status: "critical", label: CUSTOMER_STATUS[status], detail: null, raw };
  }
  if (!setups.includes("APPROVED")) {
    return {
      status: "critical",
      label: "Onaylı faturalama yok",
      detail: setups.length
        ? `Faturalama durumu: ${setups.join(", ")}`
        : "Hesapta faturalama kurulumu bulunamadı",
      raw,
    };
  }

  const now = Date.now();
  const approved = budgets.filter((b) => b.status === "APPROVED");
  const active = approved.filter(
    (b) =>
      b.approvedEndTimeType === "FOREVER" ||
      !b.approvedEndDateTime ||
      Date.parse(b.approvedEndDateTime.replace(" ", "T")) > now,
  );
  if (approved.length > 0 && active.length === 0) {
    return {
      status: "critical",
      label: "Hesap bütçesi sona erdi",
      detail: "Onaylı hesap bütçelerinin süresi doldu — yeni bütçe gerekli",
      raw,
    };
  }
  for (const b of active) {
    if (b.approvedSpendingLimitType === "INFINITE") continue;
    const limit = Number(b.approvedSpendingLimitMicros ?? 0);
    const served = Number(b.amountServedMicros ?? 0);
    if (limit <= 0) continue;
    const used = served / limit;
    if (used >= 1) {
      return {
        status: "critical",
        label: "Hesap bütçesi doldu",
        detail: "Onaylı harcama limitinin tamamı kullanıldı",
        raw,
      };
    }
    if (used >= 0.9) {
      return {
        status: "warn",
        label: "Hesap bütçesi dolmak üzere",
        detail: `Limitin %${Math.round(used * 100)}'i kullanıldı`,
        raw,
      };
    }
  }

  return { status: "ok", label: "Aktif", detail: null, raw };
}
