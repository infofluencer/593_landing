/** Shared nav paths — no React components (safe for RSC → client props). */

export type PanelNavLink = {
  href: string;
  label: string;
  /** Platform sayfası — markada bu entegrasyon kapalıysa menüde gizlenir. */
  integration?: string;
};

export const TENANT_NAV_LINKS: PanelNavLink[] = [
  { href: "/", label: "Sunum" },
  { href: "/meta", label: "Meta", integration: "meta" },
  { href: "/google", label: "Google Ads", integration: "google_ads" },
  { href: "/ga4", label: "GA4", integration: "ga4" },
  { href: "/gtm", label: "GTM", integration: "gtm" },
  { href: "/budget", label: "Bütçe" },
  { href: "/faturalar", label: "Faturalar" },
  { href: "/search-console", label: "GSC", integration: "gsc" },
];

export const STAFF_NAV_LINKS: PanelNavLink[] = [
  { href: "/brands", label: "Markalar" },
  { href: "/board", label: "Durum" },
  { href: "/ekip", label: "Ekip" },
  { href: "/audit", label: "İşlem kaydı" },
  { href: "/settings", label: "Ayarlar" },
  { href: "/design", label: "Tasarım" },
];

/** Markada kapatılan platformların sayfalarını menüden çıkarır. */
export function tenantNavLinks(disabled: readonly string[]): PanelNavLink[] {
  return TENANT_NAV_LINKS.filter(
    (l) => !l.integration || !disabled.includes(l.integration),
  );
}

/** `/panel` rewrite önekini atar — tarayıcı yolu karşılaştırması için. */
function stripPanelPrefix(path: string): string {
  if (path === "/panel") return "/";
  return path.startsWith("/panel/") ? path.slice("/panel".length) : path;
}

function matches(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`);
}

export function staffPageTitle(rawPath: string): string {
  const path = stripPanelPrefix(rawPath);
  if (matches(path, "/board")) return "Durum tablosu";
  if (matches(path, "/ekip")) return "Ekip";
  if (matches(path, "/settings")) return "Ayarlar";
  if (matches(path, "/design")) return "Tasarım sistemi";
  if (matches(path, "/audit")) return "İşlem kaydı";
  if (matches(path, "/brands/sync")) return "Veri çekimi";
  if (path.startsWith("/brands/")) return "Marka detayı";
  return "Markalar";
}

const TENANT_PAGE_TITLES: Record<string, string> = {
  "/meta": "Meta",
  "/google": "Google Ads",
  "/ga4": "GA4",
  "/gtm": "GTM",
  "/budget": "Bütçe",
  "/faturalar": "Faturalar",
  "/search-console": "Search Console",
};

export function tenantPageTitle(rawPath: string, brandName: string): string {
  const path = stripPanelPrefix(rawPath);
  return TENANT_PAGE_TITLES[path] ?? brandName;
}
