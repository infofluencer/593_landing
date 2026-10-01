import { fetchMetaPeriodReach } from "@/lib/integrations/meta/insights";
import { useMockPanelData } from "@/lib/integrations/tokens";
import { resolveMetaAccountId } from "@/lib/panel/meta-ad-account-map";
import type { MockTenantBundle } from "@/lib/panel/mock-data";

/**
 * Meta erişim / sıklık: seçili dönemin tekil değeri (canlı API).
 * Başarısızsa erişim boş kalır — günlük toplam (şişik) gösterilmez.
 */
export async function withMetaPeriodReach(
  bundle: MockTenantBundle,
  range: { from: string; to: string },
): Promise<MockTenantBundle> {
  if (useMockPanelData()) return bundle;
  const metaAccountId = resolveMetaAccountId({
    slug: bundle.tenant.slug,
    name: bundle.tenant.name,
    metaAccountId: bundle.tenant.metaAccountId,
  });
  if (!metaAccountId || bundle.metaCurrent.campaigns.length === 0) {
    return bundle;
  }

  try {
    const { account, byCampaign } = await fetchMetaPeriodReach({
      metaAccountId,
      from: range.from,
      to: range.to,
    });
    return {
      ...bundle,
      metaCurrent: {
        ...bundle.metaCurrent,
        account: {
          ...bundle.metaCurrent.account,
          reach: account?.reach,
          frequency: account?.frequency ?? undefined,
        },
        campaigns: bundle.metaCurrent.campaigns.map((c) => {
          const hit = c.campaignId ? byCampaign.get(c.campaignId) : undefined;
          return {
            ...c,
            reach: hit?.reach,
            frequency: hit?.frequency ?? undefined,
          };
        }),
      },
    };
  } catch (err) {
    console.warn(
      "[meta reach]",
      bundle.tenant.slug,
      err instanceof Error ? err.message : err,
    );
    return bundle;
  }
}
