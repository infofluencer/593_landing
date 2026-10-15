import type { BrandTableRow } from "@/lib/panel/brand-table";

/** Kritik/uyarı seviyesindeki ilk ödeme/hesap sorunu (Meta önce). */
export function paymentIssue(
  r: Pick<BrandTableRow, "accounts">,
): { provider: "Meta" | "Google Ads"; label: string; critical: boolean } | null {
  for (const p of ["meta", "google"] as const) {
    const a = r.accounts[p];
    if (a && (a.status === "critical" || a.status === "warn")) {
      return {
        provider: p === "meta" ? "Meta" : "Google Ads",
        label: a.label,
        critical: a.status === "critical",
      };
    }
  }
  return null;
}

/** Saatlik senkron çalıştı ve bugün hiç harcama yok. */
export function noSpendToday(
  r: Pick<BrandTableRow, "hourlyFetched" | "todaySpend">,
): boolean {
  return r.hourlyFetched && r.todaySpend === 0;
}

/** Saatlik verisi bugün gelmeyen (hata / henüz çekilmedi) aktif kanallar. */
export function missingProviders(
  r: Pick<BrandTableRow, "todayByProvider">,
): Array<"Meta" | "Google Ads"> {
  const out: Array<"Meta" | "Google Ads"> = [];
  if (r.todayByProvider.meta.state === "error" || r.todayByProvider.meta.state === "missing")
    out.push("Meta");
  if (r.todayByProvider.google.state === "error" || r.todayByProvider.google.state === "missing")
    out.push("Google Ads");
  return out;
}
