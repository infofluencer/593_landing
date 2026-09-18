/** Shared nav paths — no React components (safe for RSC → client props). */

export type PanelNavLink = {
  href: string;
  label: string;
};

export const TENANT_NAV_LINKS: PanelNavLink[] = [
  { href: "/", label: "Sunum" },
  { href: "/meta", label: "Meta" },
  { href: "/google", label: "Google Ads" },
  { href: "/ga4", label: "GA4" },
  { href: "/gtm", label: "GTM" },
  { href: "/budget", label: "Bütçe" },
  { href: "/faturalar", label: "Faturalar" },
  { href: "/search-console", label: "GSC" },
];

export const STAFF_NAV_LINKS: PanelNavLink[] = [
  { href: "/brands", label: "Markalar" },
  { href: "/board", label: "Durum" },
  { href: "/ekip", label: "Ekip" },
  { href: "/settings", label: "Ayarlar" },
  { href: "/design", label: "Tasarım" },
];
