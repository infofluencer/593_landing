/**
 * Panel host kinds:
 * - tenant: mareen.{root} / mareen.localhost — only that brand's members
 * - staff:  admin.{root} / admin.localhost — admin/team agency portal
 * - apex:   marketing site / bare localhost — no panel session
 */

export const STAFF_HOST_SLUG = "admin";

export const RESERVED_SLUGS = new Set([
  "www",
  "app",
  "api",
  STAFF_HOST_SLUG,
  "panel",
  "mail",
]);

export type PanelHostKind = "apex" | "staff" | "tenant";

export type ResolvedPanelHost = {
  kind: PanelHostKind;
  /** Set only when kind === "tenant" */
  tenantSlug: string | null;
  hostname: string;
};

export function rootDomain(): string {
  return (process.env.ROOT_DOMAIN || "593emarketing.com").toLowerCase();
}

function isValidTenantSlug(slug: string): boolean {
  return Boolean(slug) && !slug.includes(".") && !RESERVED_SLUGS.has(slug);
}

/** Parse Host header into panel host kind + optional tenant slug. */
export function resolvePanelHost(
  hostHeader: string | null,
): ResolvedPanelHost {
  const hostname = (hostHeader?.split(":")[0] ?? "").toLowerCase();
  if (!hostname) {
    return { kind: "apex", tenantSlug: null, hostname: "" };
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return { kind: "apex", tenantSlug: null, hostname };
  }

  if (hostname.endsWith(".localhost")) {
    const slug = hostname.slice(0, -".localhost".length);
    if (slug === STAFF_HOST_SLUG) {
      return { kind: "staff", tenantSlug: null, hostname };
    }
    if (isValidTenantSlug(slug)) {
      return { kind: "tenant", tenantSlug: slug, hostname };
    }
    return { kind: "apex", tenantSlug: null, hostname };
  }

  const root = rootDomain();
  if (hostname === root || hostname === `www.${root}`) {
    return { kind: "apex", tenantSlug: null, hostname };
  }

  const suffix = `.${root}`;
  if (!hostname.endsWith(suffix)) {
    return { kind: "apex", tenantSlug: null, hostname };
  }

  const slug = hostname.slice(0, -suffix.length);
  if (slug === STAFF_HOST_SLUG) {
    return { kind: "staff", tenantSlug: null, hostname };
  }
  if (isValidTenantSlug(slug)) {
    return { kind: "tenant", tenantSlug: slug, hostname };
  }
  return { kind: "apex", tenantSlug: null, hostname };
}

/** Backward-compatible helper used by older call sites. */
export function resolveTenantSlug(hostHeader: string | null): string | null {
  const resolved = resolvePanelHost(hostHeader);
  return resolved.kind === "tenant" ? resolved.tenantSlug : null;
}

export function isStaffRole(role: string | undefined | null): boolean {
  return role === "admin" || role === "team";
}
