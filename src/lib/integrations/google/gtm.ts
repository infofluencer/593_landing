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
      `GTM ${label}: HTML döndü (HTTP ${res.status}) — Tag Manager API kapalı olabilir veya endpoint hatalı. Cloud → Library → Tag Manager API Enable.`,
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
 * - "GTM-XXXX" (lists accounts the OAuth user can see)
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
      accountsJson.error?.message || `GTM accounts ${accountsRes.status}`,
    );
  }

  for (const account of accountsJson.account ?? []) {
    const accountId = account.accountId;
    if (!accountId) continue;
    const containersRes = await fetch(
      `https://tagmanager.googleapis.com/tagmanager/v2/accounts/${accountId}/containers`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!containersRes.ok) continue;
    let containersJson: {
      container?: Array<{
        containerId?: string;
        publicId?: string;
        name?: string;
      }>;
    } & GraphErr;
    try {
      containersJson = await readGtmJson(containersRes, `containers/${accountId}`);
    } catch {
      continue;
    }

    for (const c of containersJson.container ?? []) {
      if ((c.publicId || "").toUpperCase() === want && c.containerId) {
        return {
          accountId,
          containerId: c.containerId,
          publicId: c.publicId || want,
          name: c.name || "",
        };
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

  const [containerRes, liveRes, workspacesRes] = await Promise.all([
    fetch(base, { headers }),
    fetch(`${base}/versions:live`, { headers }),
    fetch(`${base}/workspaces`, { headers }),
  ]);

  const container = await readGtmJson<{
    name?: string;
    publicId?: string;
    containerId?: string;
  } & GraphErr>(containerRes, "container");
  if (!containerRes.ok) {
    throw new Error(
      container.error?.message || `GTM container ${containerRes.status}`,
    );
  }

  let liveVersion: GtmSnapshot["liveVersion"];
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
    // Live yoksa (hiç publish edilmemiş) — fatal değil
    liveVersion = undefined;
  }

  let workspaceHasChanges = false;
  let tags: GtmSnapshot["tags"] = [];
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
