/**
 * Agency GTM web container public IDs (GTM-XXXX).
 * Fallback when TenantMapping.gtmContainerId boş / numeric değil.
 * Panel Ayarlar DB’ye yazar; sync numeric path’i DB’de saklar.
 *
 * Bulk seed: npm run db:apply-gtm-map
 */
export const GTM_PUBLIC_ID_BY_SLUG: Record<string, string> = {
  // Ajans sitesi (tenant olmayabilir)
  "593": "GTM-PGSGQN6M",
  mareen: "GTM-NDHZKCHJ",
  armonia: "GTM-WVC99Z4W",
  bahex: "GTM-PH5DFTN7",
  bebegold: "GTM-TQHX3BD3",
  bianne: "GTM-PQSRK2J",
  // Web container (sunucu sGTM ayrı)
  endospine: "GTM-K8J3DFSP",
  "ercan-yalcin": "GTM-WQ4RXMK8",
  fitik: "GTM-PGBBDD7P",
  infofluencer: "GTM-N86FBVPT",
  minipodyum: "GTM-KGWZCM5",
  mokan: "GTM-WZJD34N2",
  mraykota: "GTM-MWD5M8P4",
  orvina: "GTM-MZJWH2LF",
  ramtech: "GTM-KP397PSD",
  sekiz: "GTM-5GBSRNF7",
  suare: "GTM-546CCD6G",
  tevalli: "GTM-W2XVVL79",
  "zeynep-ozel": "GTM-TTM6JZCG",
};

/** Opsiyonel ikinci web / alternatif container (referans). */
export const GTM_PUBLIC_ID_ALT_BY_SLUG: Record<string, string> = {
  "ercan-yalcin": "GTM-PCH942PR",
};

/** Sunucu (sGTM) container’lar — sync web path kullanır; referans için. */
export const GTM_SERVER_PUBLIC_ID_BY_SLUG: Record<string, string[]> = {
  endospine: ["GTM-TGMLZ6Z3", "GTM-M9K7NKZ8", "GTM-5QGXBXT4"],
  orvina: ["GTM-P9XTTFWQ"],
  ramtech: ["GTM-MS539DXG"],
};

export const GTM_PUBLIC_ID_BY_NAME: Record<string, string> = {
  mareen: "GTM-NDHZKCHJ",
  "armonia düğün & davet": "GTM-WVC99Z4W",
  "armonia dugun & davet": "GTM-WVC99Z4W",
  "bahex mobilya": "GTM-PH5DFTN7",
  bebegold: "GTM-TQHX3BD3",
  "bi anne atölyesi": "GTM-PQSRK2J",
  "bi anne atolyesi": "GTM-PQSRK2J",
  "endospine istanbul": "GTM-K8J3DFSP",
  "endospine i̇stanbul": "GTM-K8J3DFSP",
  "op. dr. ercan yalçın": "GTM-WQ4RXMK8",
  "op. dr. ercan yalcin": "GTM-WQ4RXMK8",
  "fıtık ameliyatı": "GTM-PGBBDD7P",
  "fitik ameliyati": "GTM-PGBBDD7P",
  infofluencer: "GTM-N86FBVPT",
  minipodyum: "GTM-KGWZCM5",
  "mokan turizm": "GTM-WZJD34N2",
  mraykota: "GTM-MWD5M8P4",
  "orvina hair makeup": "GTM-MZJWH2LF",
  "ramtech bilgisayar": "GTM-KP397PSD",
  "sekiz ocakbaşı": "GTM-5GBSRNF7",
  "sekiz ocakbasi": "GTM-5GBSRNF7",
  "suare davet": "GTM-546CCD6G",
  "tevalli parasol's": "GTM-W2XVVL79",
  "tevalli parasols": "GTM-W2XVVL79",
  "zeynep özel bridal": "GTM-TTM6JZCG",
  "zeynep ozel bridal": "GTM-TTM6JZCG",
};

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function normalizePublicId(id: string): string {
  const t = id.trim().toUpperCase();
  return t.startsWith("GTM-") ? t : `GTM-${t}`;
}

/**
 * Resolve web GTM public ID for site verify / display.
 * DB’de GTM-* varsa o; değilse kod map. Numeric path public ID vermez.
 */
export function resolveGtmPublicId(tenant: {
  slug: string;
  name: string;
  mapping?: { gtmContainerId?: string | null } | null;
}): string | null {
  const fromDb = tenant.mapping?.gtmContainerId?.trim();
  if (fromDb && /^GTM-/i.test(fromDb)) return normalizePublicId(fromDb);

  const bySlug = GTM_PUBLIC_ID_BY_SLUG[tenant.slug];
  if (bySlug) return normalizePublicId(bySlug);

  const byName = GTM_PUBLIC_ID_BY_NAME[norm(tenant.name)];
  if (byName) return normalizePublicId(byName);

  const n = norm(tenant.name);
  for (const [key, id] of Object.entries(GTM_PUBLIC_ID_BY_NAME)) {
    if (n.includes(key) || key.includes(n)) return normalizePublicId(id);
  }

  return null;
}

/** True when mapping is already Tag Manager numeric path. */
export function isGtmNumericPath(value: string | null | undefined): boolean {
  return Boolean(value && /^\d+\/\d+$/.test(value.trim()));
}

/**
 * API çağrıları için ref:
 * 1) DB numeric accountId/containerId (kota)
 * 2) DB GTM-XXXX
 * 3) kod map public ID
 */
export function resolveGtmApiRef(tenant: {
  slug: string;
  name: string;
  mapping?: { gtmContainerId?: string | null } | null;
}): string | null {
  const db = tenant.mapping?.gtmContainerId?.trim() || null;
  if (isGtmNumericPath(db)) return db;
  if (db && /^GTM-/i.test(db)) return normalizePublicId(db);
  return resolveGtmPublicId(tenant);
}
