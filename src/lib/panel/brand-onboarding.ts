import type { MockTenant } from "@/lib/panel/mock-data";
import { resolveAdsCustomerId } from "@/lib/panel/google-ads-customer-map";
import { resolveMetaAccountId } from "@/lib/panel/meta-ad-account-map";

export function getBrandMissingIntegrations(opts: {
  tenant: MockTenant;
  clientOk: boolean;
  budgetOk?: boolean;
  /** Markanın kullanmadığı platformlar — eksik sayılmaz. */
  disabled?: readonly string[];
}): string[] {
  const { tenant, clientOk } = opts;
  const off = new Set(opts.disabled ?? []);
  const adsOk = Boolean(
    resolveAdsCustomerId({
      slug: tenant.slug,
      name: tenant.name,
      mapping: tenant.mapping,
    }),
  );
  const metaOk = Boolean(
    resolveMetaAccountId({
      slug: tenant.slug,
      name: tenant.name,
      metaAccountId: tenant.metaAccountId,
    }),
  );
  const ga4Ok = Boolean(tenant.mapping.ga4PropertyId);
  const gtmOk = Boolean(tenant.mapping.gtmContainerId);
  const gscOk = Boolean(tenant.mapping.gscSiteUrl);

  const missing: string[] = [];
  if (!metaOk && !off.has("meta")) missing.push("Meta");
  if (!adsOk && !off.has("google_ads")) missing.push("Ads");
  if (!ga4Ok && !off.has("ga4")) missing.push("GA4");
  if (!gtmOk && !off.has("gtm")) missing.push("GTM");
  if (!gscOk && !off.has("gsc")) missing.push("GSC");
  if (!clientOk) missing.push("müşteri");
  if (opts.budgetOk === false) missing.push("bütçe");
  return missing;
}
