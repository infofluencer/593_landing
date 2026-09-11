/**
 * Agency Meta ad account IDs under BM (META_BUSINESS_ID).
 * Fallback map when Tenant.metaAccountId boş / placeholder.
 * Panel Ayarlar DB’ye yazar (öncelikli); sync map’ten heal eder.
 *
 * Fill / refresh from BM:
 *   npx tsx scripts/fetch-meta-ad-accounts.ts --write
 * Apply to DB:
 *   npx tsx scripts/apply-meta-ad-account-map.ts
 */
import { isPlaceholderMetaAccountId } from "@/lib/panel/mapping-placeholders";

/** Panel slug → Meta ad account id (`act_…`). */
export const META_AD_ACCOUNT_BY_SLUG: Record<string, string> = {
  // Populated by scripts/fetch-meta-ad-accounts.ts --write
};

/** Optional Meta account name → act_ when slug differs from BM name. */
export const META_AD_ACCOUNT_BY_NAME: Record<string, string> = {
  // Populated by scripts/fetch-meta-ad-accounts.ts --write
};

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Normalize to `act_123…` (digits only after prefix). */
export function normalizeMetaAccountId(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  return `act_${digits}`;
}

/** Code map only (ignore DB) — used by apply / sync heal. */
export function metaAccountIdFromCodeMap(tenant: {
  slug: string;
  name: string;
}): string | null {
  const bySlug = META_AD_ACCOUNT_BY_SLUG[tenant.slug];
  if (bySlug) return normalizeMetaAccountId(bySlug);

  const byName = META_AD_ACCOUNT_BY_NAME[norm(tenant.name)];
  if (byName) return normalizeMetaAccountId(byName);

  const n = norm(tenant.name);
  for (const [key, id] of Object.entries(META_AD_ACCOUNT_BY_NAME)) {
    if (n.includes(key) || key.includes(n)) {
      return normalizeMetaAccountId(id);
    }
  }

  return null;
}

/** Reverse: act_ → panel slug (first match). */
export function slugFromMetaAccountId(
  metaAccountId: string | null | undefined,
): string | null {
  const id = normalizeMetaAccountId(metaAccountId);
  if (!id) return null;
  for (const [slug, raw] of Object.entries(META_AD_ACCOUNT_BY_SLUG)) {
    if (normalizeMetaAccountId(raw) === id) return slug;
  }
  return null;
}

export function resolveMetaAccountId(tenant: {
  slug: string;
  name: string;
  metaAccountId?: string | null;
}): string | null {
  const fromDb = tenant.metaAccountId?.trim();
  if (fromDb && !isPlaceholderMetaAccountId(fromDb)) {
    return normalizeMetaAccountId(fromDb);
  }
  return metaAccountIdFromCodeMap(tenant);
}
