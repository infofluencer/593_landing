/**
 * Agency GA4 property IDs (numeric or properties/NNN).
 * Fallback when TenantMapping.ga4PropertyId boş — panel DB öncelikli.
 *
 * Bulk seed: npm run db:apply-ga4-map
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

function normalizePropertyId(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("properties/")) return t;
  if (/^\d+$/.test(t)) return `properties/${t}`;
  return t;
}

/** Always returns `properties/{id}` or null. DB first, then code map. */
export function resolveGa4PropertyId(tenant: {
  slug: string;
  name: string;
  mapping?: { ga4PropertyId?: string | null } | null;
}): string | null {
  const fromDb = tenant.mapping?.ga4PropertyId?.trim();
  if (fromDb) return normalizePropertyId(fromDb);

  const fromMap =
    GA4_PROPERTY_BY_SLUG[tenant.slug] ||
    GA4_PROPERTY_BY_NAME[norm(tenant.name)] ||
    null;
  return fromMap ? normalizePropertyId(fromMap) : null;
}
