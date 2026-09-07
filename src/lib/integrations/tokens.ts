import { resolveSecretRef, SECRET_REFS } from "@/lib/integrations/secrets";

export class IntegrationNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationNotConfiguredError";
  }
}

export function getMetaSystemUserToken(): string {
  const token =
    resolveSecretRef(SECRET_REFS.metaSystemUser) ||
    process.env.META_SYSTEM_USER_TOKEN?.trim();
  if (!token || isPlaceholderSecret(token)) {
    throw new IntegrationNotConfiguredError(
      "Meta system user token yok (META_SYSTEM_USER_TOKEN).",
    );
  }
  return token;
}

/** BM ID’leri rakamlardan oluşur; env placeholder’ları (META_BM_ID_BURAYA vb.) sayılmaz. */
function isPlaceholderSecret(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  return /buraya|change.?me|placeholder|your[_-]?|xxxx+|todo|fixi|example/i.test(
    v,
  );
}

export function getMetaBusinessId(): string {
  const id = process.env.META_BUSINESS_ID?.trim();
  if (!id || isPlaceholderSecret(id) || !/^\d+$/.test(id)) {
    throw new IntegrationNotConfiguredError(
      !id
        ? "META_BUSINESS_ID tanımlı değil."
        : "META_BUSINESS_ID henüz gerçek BM ID değil (Meta kurulumu eksik).",
    );
  }
  return id;
}

type GoogleTokenCache = {
  accessToken: string;
  expiresAt: number;
};

const globalGoogle = globalThis as unknown as {
  __googleAccessToken?: GoogleTokenCache;
};

/**
 * Exchange agency refresh_token → access_token (single Google OAuth for all tenants).
 */
export async function getGoogleAccessToken(): Promise<string> {
  const cached = globalGoogle.__googleAccessToken;
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.accessToken;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken =
    resolveSecretRef(SECRET_REFS.googleRefreshToken) ||
    process.env.GOOGLE_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new IntegrationNotConfiguredError(
      "Google OAuth eksik (CLIENT_ID/SECRET/REFRESH_TOKEN).",
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    throw new Error(
      `Google token exchange failed: ${json.error_description || json.error || res.status}`,
    );
  }

  globalGoogle.__googleAccessToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };

  return json.access_token;
}

export function getGoogleAdsDeveloperToken(): string {
  const token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!token) {
    throw new IntegrationNotConfiguredError(
      "GOOGLE_ADS_DEVELOPER_TOKEN tanımlı değil.",
    );
  }
  return token;
}

export function getGoogleAdsLoginCustomerId(): string {
  const id = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim()?.replace(/-/g, "");
  if (!id) {
    throw new IntegrationNotConfiguredError(
      "GOOGLE_ADS_LOGIN_CUSTOMER_ID (MCC) tanımlı değil.",
    );
  }
  return id;
}

export function useMockPanelData(): boolean {
  const mode = (process.env.PANEL_DATA_MODE || "auto").toLowerCase();
  if (mode === "mock") return true;
  if (mode === "live") return false;
  // auto: mock until live credentials exist
  return !(
    process.env.META_SYSTEM_USER_TOKEN ||
    process.env.GOOGLE_REFRESH_TOKEN
  );
}
