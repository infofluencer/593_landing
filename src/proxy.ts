import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16: middleware → proxy.
 * Subdomain → tenant slug + rewrite to /panel/*
 * Also forwards Host so Auth.js trustHost uses the real tenant origin
 * (avoids redirecting demo.localhost → localhost and dropping the session cookie).
 */

export const RESERVED_SLUGS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "panel",
  "mail",
]);

const PANEL_PREFIX = "/panel";

function rootDomain(): string {
  return (process.env.ROOT_DOMAIN || "593emarketing.com").toLowerCase();
}

function isValidSlug(slug: string): boolean {
  return Boolean(slug) && !slug.includes(".") && !RESERVED_SLUGS.has(slug);
}

export function resolveTenantSlug(hostHeader: string | null): string | null {
  if (!hostHeader) return null;

  const hostname = hostHeader.split(":")[0]?.toLowerCase() ?? "";
  if (!hostname) return null;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return null;
  }
  if (hostname.endsWith(".localhost")) {
    const slug = hostname.slice(0, -".localhost".length);
    return isValidSlug(slug) ? slug : null;
  }

  const root = rootDomain();
  if (hostname === root || hostname === `www.${root}`) {
    return null;
  }

  const suffix = `.${root}`;
  if (!hostname.endsWith(suffix)) {
    return null;
  }

  const slug = hostname.slice(0, -suffix.length);
  return isValidSlug(slug) ? slug : null;
}

function shouldBypass(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/login") ||
    pathname.includes(".")
  );
}

/** Ensure Auth.js / Next see the browser Host, not the listen address. */
function applyForwardHeaders(
  request: NextRequest,
  headers: Headers,
  tenantSlug?: string | null,
) {
  const host = request.headers.get("host");
  if (host) {
    headers.set("x-forwarded-host", host);
    headers.set("host", host);
  }
  const proto = request.nextUrl.protocol.replace(":", "") || "http";
  headers.set("x-forwarded-proto", proto);
  if (tenantSlug) {
    headers.set("x-tenant-slug", tenantSlug);
  }
  // Browser path before rewrite (for login callbackUrl)
  headers.set("x-panel-pathname", request.nextUrl.pathname);
}

export function proxy(request: NextRequest) {
  const slug = resolveTenantSlug(request.headers.get("host"));
  const requestHeaders = new Headers(request.headers);
  applyForwardHeaders(request, requestHeaders, slug);

  if (!slug) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  const { pathname, search } = request.nextUrl;

  if (shouldBypass(pathname)) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  const alreadyPanel =
    pathname === PANEL_PREFIX || pathname.startsWith(`${PANEL_PREFIX}/`);
  const rewritePath = alreadyPanel
    ? pathname
    : pathname === "/"
      ? PANEL_PREFIX
      : `${PANEL_PREFIX}${pathname}`;

  const url = request.nextUrl.clone();
  url.pathname = rewritePath;
  url.search = search;

  return NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
