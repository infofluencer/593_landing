import { getGoogleAccessToken } from "@/lib/integrations/tokens";

export type GtmSnapshot = {
  containerId: string;
  publicId: string;
  name: string;
  liveVersion?: { name?: string; versionId?: string };
  tags: { name: string; type: string; paused?: boolean }[];
  workspaceHasChanges: boolean;
};

export type GtmAccountContainer = {
  accountId: string;
  containerId: string;
  publicId: string;
  name: string;
};

type GraphErr = { error?: { message?: string; status?: string } };

const globalGtm = globalThis as unknown as {
  __gtmPathCache?: Map<string, { value: GtmAccountContainer; expires: number }>;
};

function pathCache(): Map<
  string,
  { value: GtmAccountContainer; expires: number }
> {
  if (!globalGtm.__gtmPathCache) globalGtm.__gtmPathCache = new Map();
  return globalGtm.__gtmPathCache;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 saat

function quotaHint(message: string): string {
  if (
    /quota exceeded|Queries per minute|rateLimitExceeded|Too Many Requests|\b429\b/i.test(
      message,
    )
  ) {
    return `${message} — 1–2 dk bekleyip yenileyin; bir sonraki sync numeric path’i DB’ye yazar ve kota düşer.`;
  }
  return message;
}

async function readGtmJson<T extends GraphErr>(
  res: Response,
  label: string,
): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`GTM ${label}: boş yanıt (HTTP ${res.status})`);
  }
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) {
    throw new Error(
      quotaHint(
        `GTM ${label}: HTML döndü (HTTP ${res.status}) — Tag Manager API kapalı olabilir veya endpoint hatalı.`,
      ),
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      `GTM ${label}: JSON değil (HTTP ${res.status}): ${trimmed.slice(0, 120)}`,
    );
  }
}

/**
 * Resolve Tag Manager numeric path from either:
 * - "accountId/containerId"
 * - "GTM-XXXX" (lists accounts the OAuth user can see) — cached
 */
export async function resolveGtmAccountContainer(
  ref: string,
): Promise<GtmAccountContainer> {
  const trimmed = ref.trim();
  if (/^\d+\/\d+$/.test(trimmed)) {
    const [accountId, containerId] = trimmed.split("/");
    return {
      accountId,
      containerId,
      publicId: "",
      name: "",
    };
  }

  if (!/^GTM-/i.test(trimmed)) {
    throw new Error(
      "GTM ref GTM-XXXX veya accountId/containerId olmalı (örn. GTM-NDHZKCHJ veya 123/456).",
    );
  }

  const want = trimmed.toUpperCase();
  const cached = pathCache().get(want);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  const accessToken = await getGoogleAccessToken();
  const accountsRes = await fetch(
    "https://tagmanager.googleapis.com/tagmanager/v2/accounts",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const accountsJson = await readGtmJson<{
    account?: Array<{ accountId?: string; name?: string }>;
  } & GraphErr>(accountsRes, "accounts");
  if (!accountsRes.ok) {
    throw new Error(
      quotaHint(
        accountsJson.error?.message || `GTM accounts ${accountsRes.status}`,
      ),
    );
  }

  for (const account of accountsJson.account ?? []) {
    const accountId = account.accountId;
    if (!accountId) continue;
    const containersRes = await fetch(
      `https://tagmanager.googleapis.com/tagmanager/v2/accounts/${accountId}/containers`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!containersRes.ok) {
      const errBody = await containersRes.text();
      if (/quota exceeded/i.test(errBody)) {
        throw new Error(
          quotaHint(
            `Quota exceeded for tagmanager.googleapis.com (HTTP ${containersRes.status})`,
          ),
        );
      }
      continue;
    }
    let containersJson: {
      container?: Array<{
        containerId?: string;
        publicId?: string;
        name?: string;
      }>;
    } & GraphErr;
    try {
      containersJson = await readGtmJson(
        containersRes,
        `containers/${accountId}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/quota exceeded/i.test(msg)) throw err;
      continue;
    }

    for (const c of containersJson.container ?? []) {
      if ((c.publicId || "").toUpperCase() === want && c.containerId) {
        const value: GtmAccountContainer = {
          accountId,
          containerId: c.containerId,
          publicId: c.publicId || want,
          name: c.name || "",
        };
        pathCache().set(want, {
          value,
          expires: Date.now() + CACHE_TTL_MS,
        });
        return value;
      }
    }
  }

  throw new Error(
    `GTM ${want} OAuth hesabının görebileceği container listesinde yok (yetki / yanlış ID). Refresh token hesabına Tag Manager erişimi ver.`,
  );
}

/**
 * GTM Admin API — container + live version + workspace tags.
 * Not: list endpoint `/versions` yok; live için `versions:live` kullanılır.
 */
export async function fetchGtmSnapshot(opts: {
  accountId: string;
  containerId: string;
}): Promise<GtmSnapshot> {
  const accessToken = await getGoogleAccessToken();
  const base = `https://tagmanager.googleapis.com/tagmanager/v2/accounts/${opts.accountId}/containers/${opts.containerId}`;
  const headers = { Authorization: `Bearer ${accessToken}` };

  // Sıralı çağrı — paralel burst kotayı kolay aşıyor.
  const containerRes = await fetch(base, { headers });
  const container = await readGtmJson<{
    name?: string;
    publicId?: string;
    containerId?: string;
  } & GraphErr>(containerRes, "container");
  if (!containerRes.ok) {
    throw new Error(
      quotaHint(
        container.error?.message || `GTM container ${containerRes.status}`,
      ),
    );
  }

  let liveVersion: GtmSnapshot["liveVersion"];
  const liveRes = await fetch(`${base}/versions:live`, { headers });
  if (liveRes.ok) {
    const live = await readGtmJson<{
      name?: string;
      containerVersionId?: string;
    } & GraphErr>(liveRes, "versions:live");
    liveVersion = {
      name: live.name,
      versionId: live.containerVersionId,
    };
  } else {
    liveVersion = undefined;
  }

  let workspaceHasChanges = false;
  let tags: GtmSnapshot["tags"] = [];
  const workspacesRes = await fetch(`${base}/workspaces`, { headers });
  if (workspacesRes.ok) {
    const workspaces = await readGtmJson<{
      workspace?: Array<{ workspaceId?: string; name?: string }>;
    } & GraphErr>(workspacesRes, "workspaces");
    workspaceHasChanges = (workspaces.workspace?.length ?? 0) > 0;
    const workspaceId = workspaces.workspace?.[0]?.workspaceId;
    if (workspaceId) {
      const tagsRes = await fetch(`${base}/workspaces/${workspaceId}/tags`, {
        headers,
      });
      if (tagsRes.ok) {
        const tagsJson = await readGtmJson<{
          tag?: Array<{ name?: string; type?: string; paused?: boolean }>;
        } & GraphErr>(tagsRes, "tags");
        tags = (tagsJson.tag ?? []).map((t) => ({
          name: t.name || "(tag)",
          type: t.type || "unknown",
          paused: Boolean(t.paused),
        }));
      }
    }
  }

  return {
    containerId: String(container.containerId || opts.containerId),
    publicId: container.publicId || "",
    name: container.name || "",
    liveVersion,
    tags,
    workspaceHasChanges,
  };
}

/** Convenience: public ID veya account/container → snapshot. */
export async function fetchGtmSnapshotByRef(ref: string): Promise<GtmSnapshot> {
  const path = await resolveGtmAccountContainer(ref);
  return fetchGtmSnapshot({
    accountId: path.accountId,
    containerId: path.containerId,
  });
}

/** Resolve + snapshot; numeric path’i caller DB’ye yazabilsin diye path döner. */
export async function fetchGtmSnapshotResolved(ref: string): Promise<{
  snapshot: GtmSnapshot;
  path: GtmAccountContainer;
}> {
  const path = await resolveGtmAccountContainer(ref);
  const snapshot = await fetchGtmSnapshot({
    accountId: path.accountId,
    containerId: path.containerId,
  });
  return { snapshot, path };
}
