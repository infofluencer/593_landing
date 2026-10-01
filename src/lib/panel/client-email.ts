import { RESERVED_SLUGS, rootDomain } from "@/lib/panel/host";

/** Panel subdomain (slug) — a-z, 0-9, tire. */
export function normalizePanelSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function validatePanelSlug(slug: string): string | null {
  if (!slug || slug.includes(".") || RESERVED_SLUGS.has(slug)) {
    return "Geçersiz veya reserved panel adresi";
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return "Panel adresi yalnızca a-z, 0-9 ve tire olmalı";
  }
  return null;
}

/** `{slug}@{rootDomain}` — müşteri girişi için tek kabul edilen biçim. */
export function clientEmailForPanel(
  slug: string,
  domain: string = rootDomain(),
): string {
  return `${slug}@${domain}`;
}

export function emailLocalPart(email: string): string {
  const at = email.indexOf("@");
  return at === -1 ? email.trim().toLowerCase() : email.slice(0, at).trim().toLowerCase();
}

export function emailDomainPart(email: string): string {
  const at = email.indexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase();
}

/**
 * Müşteri e-postası panel adresi ile birebir eşleşmeli:
 * local-part === slug ve domain === rootDomain.
 * Harici (gmail vb.) veya slug’dan farklı local-part kabul edilmez.
 */
export function assertClientEmailForPanel(
  email: string,
  panelSlug: string,
  domain: string = rootDomain(),
): string | null {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return "Geçerli e-posta gerekli";
  }

  const slug = normalizePanelSlug(panelSlug);
  const slugErr = validatePanelSlug(slug);
  if (slugErr) return slugErr;

  const local = emailLocalPart(normalizedEmail);
  const host = emailDomainPart(normalizedEmail);
  const expected = clientEmailForPanel(slug, domain);

  if (host !== domain.toLowerCase()) {
    return `E-posta yalnızca @${domain} olabilir (harici adres kabul edilmez)`;
  }
  if (local !== slug) {
    return `E-posta, panel adresi ile eşleşmeli: ${expected}`;
  }
  return null;
}
