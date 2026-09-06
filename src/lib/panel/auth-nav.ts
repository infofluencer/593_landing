/**
 * Auth navigation helpers — keep user on the same host as the session cookie.
 */

/** Only allow same-origin relative paths (open-redirect safe). */
export function sanitizeCallbackPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.startsWith("/login")) return fallback;
  // Never send browser to internal rewrite prefix
  if (trimmed === "/panel" || trimmed.startsWith("/panel/")) {
    const rest = trimmed.slice("/panel".length) || "/";
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return trimmed;
}

export function loginHref(callbackPath?: string): string {
  const path = sanitizeCallbackPath(callbackPath, "/");
  if (path === "/") return "/login";
  return `/login?callbackUrl=${encodeURIComponent(path)}`;
}
