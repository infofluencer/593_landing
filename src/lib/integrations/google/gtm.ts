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

type GraphErr = { error?: { message?: string } };

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
  const accountsJson = (await accountsRes.json()) as {
    account?: Array<{ accountId?: string; name?: string }>;
  } & GraphErr;
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
    const containersJson = (await containersRes.json()) as {
      container?: Array<{
        containerId?: string;
        publicId?: string;
        name?: string;
      }>;
    } & GraphErr;
    if (!containersRes.ok) continue;

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
    `GTM ${want} OAuth hesabının görebileceği container listesinde yok (yetki / yanlış ID).`,
  );
}

/**
 * GTM Admin API — list container tags + live version summary.
 */
export async function fetchGtmSnapshot(opts: {
  accountId: string;
  containerId: string;
}): Promise<GtmSnapshot> {
  const accessToken = await getGoogleAccessToken();
  const base = `https://tagmanager.googleapis.com/tagmanager/v2/accounts/${opts.accountId}/containers/${opts.containerId}`;

  const [containerRes, versionsRes, workspacesRes] = await Promise.all([
    fetch(base, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch(`${base}/versions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch(`${base}/workspaces`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  const container = (await containerRes.json()) as {
    name?: string;
    publicId?: string;
    containerId?: string;
    error?: { message?: string };
  };
  if (!containerRes.ok) {
    throw new Error(
      container.error?.message || `GTM container ${containerRes.status}`,
    );
  }

  const versions = (await versionsRes.json()) as {
    containerVersion?: Array<{ name?: string; containerVersionId?: string }>;
    error?: { message?: string };
  };

  const workspaces = (await workspacesRes.json()) as {
    workspace?: Array<{ workspaceId?: string; name?: string }>;
  };

  const live = versions.containerVersion?.[0];
  const workspaceId = workspaces.workspace?.[0]?.workspaceId;

  let tags: GtmSnapshot["tags"] = [];
  if (workspaceId) {
    const tagsRes = await fetch(`${base}/workspaces/${workspaceId}/tags`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const tagsJson = (await tagsRes.json()) as {
      tag?: Array<{ name?: string; type?: string; paused?: boolean }>;
    };
    if (tagsRes.ok) {
      tags = (tagsJson.tag ?? []).map((t) => ({
        name: t.name || "(tag)",
        type: t.type || "unknown",
        paused: Boolean(t.paused),
      }));
    }
  }

  return {
    containerId: String(container.containerId || opts.containerId),
    publicId: container.publicId || "",
    name: container.name || "",
    liveVersion: live
      ? { name: live.name, versionId: live.containerVersionId }
      : undefined,
    tags,
    workspaceHasChanges: (workspaces.workspace?.length ?? 0) > 0,
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
