import { getGoogleAccessToken } from "@/lib/integrations/tokens";

export type GtmSnapshot = {
  containerId: string;
  publicId: string;
  name: string;
  liveVersion?: { name?: string; versionId?: string };
  tags: { name: string; type: string; paused?: boolean }[];
  workspaceHasChanges: boolean;
};

/**
 * GTM Admin API — list container tags + live version summary.
 * containerPath like "accounts/123/containers/456" or just public id lookup helper.
 */
export async function fetchGtmSnapshot(opts: {
  /** Full path accounts/{a}/containers/{c} preferred; or numeric container id with accountId */
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
    throw new Error(container.error?.message || `GTM container ${containerRes.status}`);
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
