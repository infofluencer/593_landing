import {
  getMetaBusinessId,
  getMetaSystemUserToken,
} from "@/lib/integrations/tokens";

const GRAPH = "https://graph.facebook.com/v21.0";

export type MetaAdAccount = {
  id: string;
  account_id: string;
  name: string;
  currency?: string;
  timezone_name?: string;
  account_status?: number;
  business?: { id: string; name?: string };
};

type GraphPage<T> = {
  data?: T[];
  paging?: { next?: string; cursors?: { after?: string } };
  error?: { message: string; code?: number };
};

async function graphGet<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<GraphPage<T>> {
  const token = getMetaSystemUserToken();
  const url = new URL(path.startsWith("http") ? path : `${GRAPH}/${path}`);
  if (!path.startsWith("http")) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("access_token", token);
  }

  const res = await fetch(url.toString(), { method: "GET" });
  const json = (await res.json()) as GraphPage<T>;
  if (!res.ok || json.error) {
    throw new Error(
      json.error?.message || `Meta Graph error ${res.status} on ${path}`,
    );
  }
  return json;
}

/** Paginate owned + client ad accounts for the agency BM. */
export async function listBusinessAdAccounts(): Promise<MetaAdAccount[]> {
  const businessId = getMetaBusinessId();
  const fields =
    "id,account_id,name,currency,timezone_name,account_status,business{id,name}";
  const edges = ["owned_ad_accounts", "client_ad_accounts"] as const;
  const all: MetaAdAccount[] = [];
  const seen = new Set<string>();

  for (const edge of edges) {
    let next: string | null =
      `${businessId}/${edge}?fields=${encodeURIComponent(fields)}&limit=100`;

    while (next) {
      const page: GraphPage<MetaAdAccount> = next.startsWith("http")
        ? await graphGet<MetaAdAccount>(next)
        : await graphGet<MetaAdAccount>(next);

      for (const row of page.data ?? []) {
        const key = row.id || `act_${row.account_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        all.push({
          ...row,
          id: row.id?.startsWith("act_") ? row.id : `act_${row.account_id}`,
        });
      }

      next = page.paging?.next ?? null;
    }
  }

  return all;
}
