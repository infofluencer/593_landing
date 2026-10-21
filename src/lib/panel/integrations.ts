/**
 * Marka bazında kapatılabilen platformlar. Kapalı platform: senkron atlanır,
 * eksik eşleşme / çekim hatası uyarı sayılmaz.
 */

export type IntegrationKey = "meta" | "google_ads" | "ga4" | "gtm" | "gsc";

export const INTEGRATIONS: ReadonlyArray<{
  key: IntegrationKey;
  label: string;
  description: string;
}> = [
  { key: "meta", label: "Meta Ads", description: "Kampanya, reklam, fatura, saatlik harcama ve ödeme durumu" },
  { key: "google_ads", label: "Google Ads", description: "Kampanya, fatura, saatlik harcama ve ödeme durumu" },
  { key: "ga4", label: "GA4", description: "Trafik ve anahtar etkinlikler" },
  { key: "gtm", label: "Tag Manager", description: "Etiket yapılandırması" },
  { key: "gsc", label: "Search Console", description: "Organik arama sorguları" },
];

export const INTEGRATION_KEYS = INTEGRATIONS.map((i) => i.key);

export function isIntegrationKey(v: unknown): v is IntegrationKey {
  return typeof v === "string" && (INTEGRATION_KEYS as string[]).includes(v);
}

/** SyncJob (provider, service) → platform. Sentinel/kilit satırları null. */
export function integrationForJob(
  provider: string,
  service: string,
): IntegrationKey | null {
  if (provider === "meta") {
    return ["insights", "ad_insights", "ads", "billing", "hourly", "account_status"].includes(service)
      ? "meta"
      : null;
  }
  if (["ads", "billing", "hourly", "account_status"].includes(service)) return "google_ads";
  if (service === "ga4") return "ga4";
  if (service === "gtm") return "gtm";
  if (service === "gsc") return "gsc";
  return null;
}

/** Kapalı platformlara ait job'ları çıkarır. */
export function withoutDisabledJobs<T extends { provider: string; service: string }>(
  jobs: T[],
  disabled: readonly string[],
): T[] {
  if (disabled.length === 0) return jobs;
  return jobs.filter((j) => {
    const key = integrationForJob(j.provider, j.service);
    return !key || !disabled.includes(key);
  });
}

/** Platform kapatılınca çözülecek alarm tipleri (alerts-engine + saatlik kontrol). */
export const ALERT_TYPES_BY_INTEGRATION: Record<IntegrationKey, string[]> = {
  meta: ["sync_error_meta", "payment_meta", "spend_stopped_meta", "token_expired_meta", "missing_mapping_meta"],
  google_ads: ["missing_mapping", "sync_error", "payment_google", "spend_stopped_google", "token_expired_google"],
  ga4: ["sync_error_ga4", "missing_mapping_ga4"],
  gtm: ["missing_mapping_gtm"],
  gsc: ["missing_mapping_gsc"],
};

/** Platform markada kapalı mı — canlı API çağrısından önce kontrol. */
export function isIntegrationDisabled(
  tenant: { disabledIntegrations?: readonly string[] | null },
  key: IntegrationKey,
): boolean {
  return tenant.disabledIntegrations?.includes(key) ?? false;
}
