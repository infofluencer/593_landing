/**
 * Admin wizard / settings — kod map’ten öneri (DB boşken doldurmak için).
 */
import {
  adsCustomerIdFromCodeMap,
  GOOGLE_ADS_CUSTOMER_BY_SLUG,
} from "@/lib/panel/google-ads-customer-map";
import {
  ga4PropertyIdFromCodeMap,
  GA4_PROPERTY_BY_SLUG,
} from "@/lib/panel/ga4-property-map";
import {
  GTM_PUBLIC_ID_BY_SLUG,
} from "@/lib/panel/gtm-container-map";
import {
  metaAccountIdFromCodeMap,
  META_AD_ACCOUNT_BY_SLUG,
  normalizeMetaAccountId,
} from "@/lib/panel/meta-ad-account-map";

export type BrandMapHints = {
  metaAccountId: string | null;
  adsCustomerId: string | null;
  ga4PropertyId: string | null;
  gtmContainerId: string | null;
};

export function brandMapHintsFor(tenant: {
  slug: string;
  name: string;
}): BrandMapHints {
  const slug = tenant.slug.trim().toLowerCase();
  const name = tenant.name.trim() || slug;
  return {
    metaAccountId:
      metaAccountIdFromCodeMap({ slug, name }) ||
      normalizeMetaAccountId(META_AD_ACCOUNT_BY_SLUG[slug]) ||
      null,
    adsCustomerId:
      adsCustomerIdFromCodeMap({ slug, name }) ||
      GOOGLE_ADS_CUSTOMER_BY_SLUG[slug] ||
      null,
    ga4PropertyId:
      ga4PropertyIdFromCodeMap({ slug, name }) ||
      GA4_PROPERTY_BY_SLUG[slug] ||
      null,
    gtmContainerId: GTM_PUBLIC_ID_BY_SLUG[slug] || null,
  };
}

/** Kullanıcı `act_` yazmasa da normalize et. */
export function draftMetaAccountId(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return normalizeMetaAccountId(t) || t;
}
