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
  "armonia": "act_297746326552066",
  "bahex": "act_1249571952455471",
  "endospine": "act_1531490041307558", // Endoskopik Bel Ameliyato
  "ercan-yalcin": "act_671669315040403",
  "mareen": "act_2321566658363452",
  "mokan": "act_2178439542611486",
  "mraykota": "act_1364903731510777", // Doç. Dr. Muhammed Raşid Aykota
  "orvina": "act_1635446947318192",
  "ramtech": "act_1231587451239600",
  "sekiz": "act_1406982224128410",
  "suare": "act_4252118865101784",
  "tevalli": "act_1167188141041316",
  "zeynep-ozel": "act_276161233026397",
  "zeynep-ozel-bridal": "act_276161233026397",
};

/** Optional Meta account name → act_ when slug differs from BM name. */
export const META_AD_ACCOUNT_BY_NAME: Record<string, string> = {
  "165837674": "act_165837674",
  "273072363296745": "act_273072363296745",
  "2990529357911124": "act_2990529357911124",
  "38310022": "act_38310022",
  "593 emarketing ads": "act_658697156946582",
  "anadolu international hospitals": "act_1560103068369525",
  "armofest": "act_4482442148703522",
  "armonia bm": "act_297746326552066",
  "ayakkab m ozel yeni reklam hesab": "act_1071609628391633",
  "bahex insta": "act_1249571952455471",
  "doc dr muhammed rasid aykota": "act_1364903731510777",
  "endoskopik bel ameliyato": "act_1531490041307558",
  "il silivri anadolu": "act_1079905296390683",
  "jasmin k na org": "act_943974661513558",
  "mareen ads": "act_2321566658363452",
  "mokan travel": "act_2178439542611486",
  "op dr ercan yalc n": "act_671669315040403",
  "orvina hair makeup": "act_1635446947318192",
  "ramtech bilgisayar": "act_1231587451239600",
  "sekiz ocakbas": "act_1406982224128410",
  "senkronise": "act_2561490870828625",
  "suare davet 593": "act_4252118865101784",
  "tevalli parasol s": "act_1167188141041316",
  "y ld z teknik universitesi": "act_1090447746482793",
  "zeynep ozel bridal": "act_276161233026397",
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
