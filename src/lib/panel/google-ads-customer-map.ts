/**
 * Agency Google Ads customer IDs under MCC (GOOGLE_ADS_LOGIN_CUSTOMER_ID).
 * Source of truth for Ads sync — not the panel Ayarlar form.
 *
 * Add/edit here when a brand is linked under the MCC, then run:
 *   npx tsx scripts/apply-google-ads-map.ts
 * (or prisma db seed)
 */
export const GOOGLE_ADS_CUSTOMER_BY_SLUG: Record<string, string> = {
  mareen: "9557333129",
  armonia: "9579618441",
  bahex: "3136474048",
  bianne: "6635556070",
  endospine: "6474329013",
  fitik: "9298256533",
  mokan: "3473326547",
  "ercan-yalcin": "3699944900",
  orvina: "8491475088",
  sekiz: "1874717609",
  suare: "1413886211",
  tevalli: "9083593366",
  turkler: "3242508842",
  "zeynep-ozel": "4293360096",
  mraykota: "7372220376",
  ramtech: "8925207068",
};

/** Optional name → id when tenant slug differs from the map key. */
export const GOOGLE_ADS_CUSTOMER_BY_NAME: Record<string, string> = {
  mareen: "9557333129",
  "armonia düğün & davet": "9579618441",
  "armonia dugun & davet": "9579618441",
  "bahex mobilya": "3136474048",
  "bi anne atölyesi": "6635556070",
  "bi anne atolyesi": "6635556070",
  "endospine istanbul": "6474329013",
  "endospine i̇stanbul": "6474329013",
  "fıtık ameliyatı": "9298256533",
  "fitik ameliyati": "9298256533",
  "mokan turizm tic.ltd.şti.": "3473326547",
  "mokan turizm": "3473326547",
  "op. dr. ercan yalçın": "3699944900",
  "op. dr. ercan yalcin": "3699944900",
  "orvina hair makeup": "8491475088",
  "sekiz ocakbaşı": "1874717609",
  "sekiz ocakbasi": "1874717609",
  "suare davet": "1413886211",
  "tevalli parasol's": "9083593366",
  "tevalli parasols": "9083593366",
  "türkler şemsiye": "3242508842",
  "turkler semsiye": "3242508842",
  "zeynep özel bridal": "4293360096",
  "zeynep ozel bridal": "4293360096",
  "https://www.mraykota.com/": "7372220376",
  mraykota: "7372220376",
  "ramtech bilgisayar": "8925207068",
};

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function resolveAdsCustomerId(tenant: {
  slug: string;
  name: string;
  mapping?: { adsCustomerId?: string | null } | null;
}): string | null {
  const bySlug = GOOGLE_ADS_CUSTOMER_BY_SLUG[tenant.slug];
  if (bySlug) return bySlug.replace(/-/g, "");

  const byName = GOOGLE_ADS_CUSTOMER_BY_NAME[norm(tenant.name)];
  if (byName) return byName.replace(/-/g, "");

  // partial name contains map key
  const n = norm(tenant.name);
  for (const [key, id] of Object.entries(GOOGLE_ADS_CUSTOMER_BY_NAME)) {
    if (n.includes(key) || key.includes(n)) return id.replace(/-/g, "");
  }

  const fromDb = tenant.mapping?.adsCustomerId?.trim();
  return fromDb ? fromDb.replace(/-/g, "") : null;
}
