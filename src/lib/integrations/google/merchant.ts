import { getGoogleAccessToken } from "@/lib/integrations/tokens";

export type MerchantProductIssue = {
  offerId: string;
  title: string;
  severity: string;
  detail: string;
};

/**
 * Merchant API — product statuses / issues (e-commerce tenants).
 * Uses Content API for Shopping legacy-compatible productstatuses list when Merchant API
 * account id is provided as merchantId.
 */
export async function fetchMerchantProductIssues(opts: {
  merchantId: string;
}): Promise<MerchantProductIssue[]> {
  const accessToken = await getGoogleAccessToken();
  const res = await fetch(
    `https://shoppingcontent.googleapis.com/content/v2.1/${opts.merchantId}/productstatuses?maxResults=50`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  const json = (await res.json()) as {
    resources?: Array<{
      productId?: string;
      title?: string;
      itemLevelIssues?: Array<{
        code?: string;
        severity?: string;
        detail?: string;
        description?: string;
      }>;
    }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(json.error?.message || `Merchant API ${res.status}`);
  }

  const issues: MerchantProductIssue[] = [];
  for (const product of json.resources ?? []) {
    for (const issue of product.itemLevelIssues ?? []) {
      issues.push({
        offerId: product.productId || "",
        title: product.title || "",
        severity: issue.severity || "unknown",
        detail: issue.detail || issue.description || issue.code || "",
      });
    }
  }
  return issues;
}
