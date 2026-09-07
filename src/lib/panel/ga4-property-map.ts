/**
 * Agency GA4 property IDs (numeric or properties/NNN).
 * Source of truth for GA4 sync — Ayarlar yedek.
 *
 * Add/edit here, then optionally:
 *   npm run db:apply-ga4-map
 */
export const GA4_PROPERTY_BY_SLUG: Record<string, string> = {
  mareen: "515758171",
};

export const GA4_PROPERTY_BY_NAME: Record<string, string> = {
  mareen: "515758171",
};

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Always returns `properties/{id}` or null. */
export function resolveGa4PropertyId(tenant: {
  slug: string;
  name: string;
  mapping?: { ga4PropertyId?: string | null } | null;
}): string | null {
  const raw =
    GA4_PROPERTY_BY_SLUG[tenant.slug] ||
    GA4_PROPERTY_BY_NAME[norm(tenant.name)] ||
    tenant.mapping?.ga4PropertyId?.trim() ||
    null;
  if (!raw) return null;
  if (raw.startsWith("properties/")) return raw;
  if (/^\d+$/.test(raw)) return `properties/${raw}`;
  return raw;
}
