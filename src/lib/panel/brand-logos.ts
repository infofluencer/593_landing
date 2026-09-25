/** Landing `/public/brands` assets — slug / name ile eşleştir. */
const LOGO_BY_SLUG: Record<string, string> = {
  mareen: "/brands/mareen.png",
  "tevalli-parasols": "/brands/tevalli-parasols.png",
  tevalli: "/brands/tevalli-parasols.png",
  "endospine-istanbul": "/brands/endospine-istanbul.png",
  endospine: "/brands/endospine-istanbul.png",
  "armonia-davet": "/brands/armonia-davet.png",
  armonia: "/brands/armonia-davet.png",
  "yildiz-teknik": "/brands/yildiz-teknik.png",
  "ramtech-bilgisayar": "/brands/ramtech-bilgisayar.png",
  ramtech: "/brands/ramtech-bilgisayar.png",
  "turkler-semsiye": "/brands/turkler-semsiye.png",
  "zeynep-ozel": "/brands/zeynep-ozel.png",
  "guler-kuyumculuk": "/brands/guler-kuyumculuk.png",
  "bahex-mobilya": "/brands/bahex-mobilya.png",
  bahex: "/brands/bahex-mobilya.png",
  "yedi-mavi-cadde": "/brands/yedi-mavi-cadde.png",
  "anadolu-hastaneleri": "/brands/anadolu-hastaneleri.png",
  anadolu: "/brands/anadolu-hastaneleri.png",
  "suare-davet": "/brands/suare-davet.png",
  suare: "/brands/suare-davet.png",
  "mokan-travel": "/brands/mokan-travel.svg",
  mokan: "/brands/mokan-travel.svg",
  "eyup-baykara": "/brands/eyup-baykara.png",
  infofluencer: "/brands/infofluencer.svg",
  bump: "/brands/bump.jpeg",
  "bi-anne-atolyesi": "/brands/bi-anne-atolyesi.png",
  "sekiz-ocakbasi": "/brands/sekiz-ocakbasi.png",
};

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function resolveBrandCover(opts: {
  slug: string;
  name?: string | null;
  coverUrl?: string | null;
}): { src: string; fit: "cover" | "contain" } | null {
  const cover = opts.coverUrl?.trim();
  if (cover) return { src: cover, fit: "cover" };
  const logo = resolveBrandLogo(opts.slug, opts.name);
  if (logo) return { src: logo, fit: "contain" };
  return null;
}

/** Statik `/brands` logosu veya yüklenen kapak — “logolu marka”. */
export function hasBrandLogo(opts: {
  slug: string;
  name?: string | null;
  coverUrl?: string | null;
}): boolean {
  return resolveBrandCover(opts) != null;
}

export function resolveBrandLogo(
  slug: string,
  name?: string | null,
): string | null {
  const slugKey = normalizeKey(slug);
  if (LOGO_BY_SLUG[slugKey]) return LOGO_BY_SLUG[slugKey];

  if (name) {
    const nameKey = normalizeKey(name);
    if (LOGO_BY_SLUG[nameKey]) return LOGO_BY_SLUG[nameKey];
    for (const [key, logo] of Object.entries(LOGO_BY_SLUG)) {
      if (nameKey.includes(key) || key.includes(nameKey)) return logo;
    }
  }

  // slug parçası: armonia-xyz → armonia
  const head = slugKey.split("-")[0];
  if (head && LOGO_BY_SLUG[head]) return LOGO_BY_SLUG[head];

  return null;
}

export function brandInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}
