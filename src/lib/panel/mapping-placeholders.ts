/**
 * Known mock / seed placeholder Google IDs (from mock-data.ts).
 * Resolvers treat these as empty so code maps / real Settings win.
 */

export function isPlaceholderAdsCustomerId(
  raw: string | null | undefined,
): boolean {
  if (!raw?.trim()) return true;
  const n = raw.replace(/-/g, "").trim();
  return n === "4445556666" || n === "1112223333";
}

/** Mock / seed Meta act_ ids (mock-data + seed). */
export function isPlaceholderMetaAccountId(
  raw: string | null | undefined,
): boolean {
  if (!raw?.trim()) return true;
  const t = raw.trim().toLowerCase();
  if (t === "act_mareen_001" || t === "act_phase0_demo") return true;
  if (t.startsWith("act_") && /[a-z]/.test(t.slice(4))) return true;
  const digits = t.replace(/\D/g, "");
  return !digits;
}

export function isPlaceholderGa4PropertyId(
  raw: string | null | undefined,
): boolean {
  if (!raw?.trim()) return true;
  const n = raw
    .trim()
    .replace(/^properties\//i, "")
    .replace(/\D/g, "");
  return n === "987654321" || n === "123456789";
}

/** Mock numeric paths 123/456, 111/222 — not real GTM containers. */
export function isPlaceholderGtmId(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return true;
  const t = raw.trim();
  return t === "123/456" || t === "111/222";
}

export function isPlaceholderMerchantId(
  raw: string | null | undefined,
): boolean {
  if (!raw?.trim()) return true;
  const t = raw.trim().toLowerCase();
  // mock-data + non-numeric junk
  if (t === "merchant_mareen" || t.startsWith("merchant_")) return true;
  // Content API expects numeric Merchant Center ID
  if (!/^\d+$/.test(t)) return true;
  return false;
}

/** Normalize mapping fields before DB write — placeholders → null. */
export function sanitizeMappingForDb(m: {
  adsCustomerId?: string | null;
  ga4PropertyId?: string | null;
  gtmContainerId?: string | null;
  gscSiteUrl?: string | null;
  merchantId?: string | null;
}): {
  adsCustomerId: string | null | undefined;
  ga4PropertyId: string | null | undefined;
  gtmContainerId: string | null | undefined;
  gscSiteUrl: string | null | undefined;
  merchantId: string | null | undefined;
} {
  const ads =
    m.adsCustomerId === undefined
      ? undefined
      : m.adsCustomerId == null || isPlaceholderAdsCustomerId(m.adsCustomerId)
        ? null
        : m.adsCustomerId.trim();
  const ga4 =
    m.ga4PropertyId === undefined
      ? undefined
      : m.ga4PropertyId == null || isPlaceholderGa4PropertyId(m.ga4PropertyId)
        ? null
        : m.ga4PropertyId.trim();
  const gtm =
    m.gtmContainerId === undefined
      ? undefined
      : m.gtmContainerId == null || isPlaceholderGtmId(m.gtmContainerId)
        ? null
        : m.gtmContainerId.trim();
  const merchant =
    m.merchantId === undefined
      ? undefined
      : m.merchantId == null || isPlaceholderMerchantId(m.merchantId)
        ? null
        : m.merchantId.trim();
  return {
    adsCustomerId: ads,
    ga4PropertyId: ga4,
    gtmContainerId: gtm,
    gscSiteUrl: m.gscSiteUrl,
    merchantId: merchant,
  };
}
