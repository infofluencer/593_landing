/**
 * Secret store accessor — Postgres never holds raw tokens.
 * Refs look like: "env:META_SYSTEM_USER_TOKEN" or "env:GOOGLE_REFRESH_TOKEN"
 */
export function resolveSecretRef(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const trimmed = ref.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("env:")) {
    const key = trimmed.slice(4);
    const value = process.env[key];
    return value && value.trim() ? value.trim() : null;
  }

  // Future: vault:/path, aws-sm:name, etc.
  throw new Error(`Unsupported secret ref scheme: ${trimmed.split(":")[0]}`);
}

export const SECRET_REFS = {
  metaSystemUser: "env:META_SYSTEM_USER_TOKEN",
  googleRefreshToken: "env:GOOGLE_REFRESH_TOKEN",
} as const;
