import { NextResponse, type NextRequest } from "next/server";
import { resolvePanelHost } from "@/lib/panel/host";

/**
 * Next.js 16: middleware → proxy.
 * Subdomain → tenant or staff panel + rewrite to /panel/*
 * Also forwards Host so Auth.js trustHost uses the real tenant origin
 * (avoids redirecting demo.localhost → localhost and dropping the session cookie).
 */

const PANEL_PREFIX = "/panel";

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
  host: ReturnType<typeof resolvePanelHost>,
) {
  const reqHost = request.headers.get("host");
  if (reqHost) {
    headers.set("x-forwarded-host", reqHost);
    headers.set("host", reqHost);
  }
  const proto = request.nextUrl.protocol.replace(":", "") || "http";
  headers.set("x-forwarded-proto", proto);
  headers.set("x-panel-mode", host.kind);
  if (host.tenantSlug) {
    headers.set("x-tenant-slug", host.tenantSlug);
  }
  // Browser path before rewrite (for login callbackUrl)
  headers.set("x-panel-pathname", request.nextUrl.pathname);
}

function rewriteToPanel(request: NextRequest, requestHeaders: Headers) {
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

export function proxy(request: NextRequest) {
  const host = resolvePanelHost(request.headers.get("host"));
  const requestHeaders = new Headers(request.headers);
  applyForwardHeaders(request, requestHeaders, host);

  if (host.kind === "tenant" || host.kind === "staff") {
    return rewriteToPanel(request, requestHeaders);
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

/** Re-export for any external imports of the old API. */
export { RESERVED_SLUGS, resolveTenantSlug } from "@/lib/panel/host";
