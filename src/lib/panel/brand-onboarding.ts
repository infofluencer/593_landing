import type { MockTenant } from "@/lib/panel/mock-data";
import { resolveAdsCustomerId } from "@/lib/panel/google-ads-customer-map";
import { resolveMetaAccountId } from "@/lib/panel/meta-ad-account-map";

export function getBrandMissingIntegrations(opts: {
  tenant: MockTenant;
  clientOk: boolean;
  budgetOk?: boolean;
}): string[] {
  const { tenant, clientOk } = opts;
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
  if (!metaOk) missing.push("Meta");
  if (!adsOk) missing.push("Ads");
  if (!ga4Ok) missing.push("GA4");
  if (!gtmOk) missing.push("GTM");
  if (!gscOk) missing.push("GSC");
  if (!clientOk) missing.push("müşteri");
  if (opts.budgetOk === false) missing.push("bütçe");
  return missing;
}
