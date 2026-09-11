import { headers } from "next/headers";
import { Suspense, type ReactNode } from "react";
import { ChannelCard } from "@/components/panel/ChannelCard";
import { CampaignBarChart } from "@/components/panel/charts";
import PeriodFilterBar from "@/components/panel/PeriodFilterBar";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { Delta, PanelStat, PanelTable } from "@/components/panel/ui";
import {
  fetchAdsAdGroups,
  fetchAdsCampaignLostShare,
  fetchAdsKeywords,
  fetchAdsSearchTerms,
  type AdsAdGroupRow,
  type AdsCampaignShareRow,
  type AdsKeywordRow,
  type AdsSearchTermRow,
} from "@/lib/integrations/google/ads";
import { useMockPanelData } from "@/lib/integrations/tokens";
import { requireBundle } from "@/lib/panel/data";
import { resolveAdsCustomerId } from "@/lib/panel/google-ads-customer-map";
import { resolvePanelDateRange } from "@/lib/panel/period";
import { buildPresentation } from "@/lib/panel/presentation";
import {
  deltaPct,
  derivedMetrics,
  type MockCampaignMetric,
} from "@/lib/panel/mock-data";
import { formatDate, formatNumber, formatTry } from "@/lib/panel/format";

function MetricRow({
  label,
  current,
  previous,
  currency,
  ecommerce,
}: {
  label: string;
  current: MockCampaignMetric;
  previous: MockCampaignMetric | undefined;
  currency: string;
  ecommerce: boolean;
}) {
  const c = derivedMetrics(current);
  const p = previous ? derivedMetrics(previous) : null;

  return (
    <tr className="text-zinc-700">
      <td className="px-3 py-2.5 font-medium text-zinc-900">{label}</td>
      <td className="px-3 py-2.5 tabular-nums">
        {formatTry(current.spend, currency)}
        <div>
          <Delta
            value={p ? deltaPct(current.spend, previous!.spend) : null}
            invert
          />
        </div>
      </td>
      <td className="px-3 py-2.5 tabular-nums">{formatNumber(current.impr)}</td>
      <td className="px-3 py-2.5 tabular-nums">{formatNumber(current.clicks)}</td>
      <td className="px-3 py-2.5 tabular-nums">{formatNumber(c.ctr, 2)}%</td>
      <td className="px-3 py-2.5 tabular-nums">
        {formatNumber(current.conv, 1)}
      </td>
      {ecommerce ? (
        <td className="px-3 py-2.5 tabular-nums">
          {formatNumber(c.roas, 2)}x
        </td>
      ) : (
        <td className="px-3 py-2.5 tabular-nums">
          {current.conv > 0 ? formatTry(c.cpa, currency) : "—"}
        </td>
      )}
    </tr>
  );
}

function formatSharePct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function matchTypeLabel(raw: string): string {
  switch (raw.toUpperCase()) {
    case "EXACT":
      return "Tam";
    case "PHRASE":
      return "Sözcük öbeği";
    case "BROAD":
      return "Geniş";
    default:
      return raw || "—";
  }
}

type LiveSlice<T> = {
  rows: T[];
  error: string | null;
};

function settledSlice<T>(
  r: PromiseSettledResult<T[]>,
): LiveSlice<T> {
  if (r.status === "fulfilled") return { rows: r.value, error: null };
  return {
    rows: [],
    error: r.reason instanceof Error ? r.reason.message : String(r.reason),
  };
}

async function loadLiveAdsDetail(
  customerId: string | null,
  from: string,
  to: string,
): Promise<{
  campaignShares: LiveSlice<AdsCampaignShareRow>;
  adGroups: LiveSlice<AdsAdGroupRow>;
  keywords: LiveSlice<AdsKeywordRow>;
  searchTerms: LiveSlice<AdsSearchTermRow>;
  skippedReason: string | null;
}> {
  const empty = {
    campaignShares: { rows: [] as AdsCampaignShareRow[], error: null },
    adGroups: { rows: [] as AdsAdGroupRow[], error: null },
    keywords: { rows: [] as AdsKeywordRow[], error: null },
    searchTerms: { rows: [] as AdsSearchTermRow[], error: null },
  };

  if (useMockPanelData()) {
    return { ...empty, skippedReason: "Mock mod — canlı Ads detayı yok" };
  }
  if (!customerId) {
    return { ...empty, skippedReason: "Google Ads customer ID yok" };
  }

  const [shares, ag, kw, st] = await Promise.allSettled([
    fetchAdsCampaignLostShare({ customerId, from, to }),
    fetchAdsAdGroups({ customerId, from, to }),
    fetchAdsKeywords({ customerId, from, to }),
    fetchAdsSearchTerms({ customerId, from, to }),
  ]);

  return {
    skippedReason: null,
    campaignShares: settledSlice(shares),
    adGroups: settledSlice(ag),
    keywords: settledSlice(kw),
    searchTerms: settledSlice(st),
  };
}

export default async function GooglePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}) {
  const h = await headers();
  const slug = h.get("x-tenant-slug")!;
  const sp = await searchParams;
  const range = await resolvePanelDateRange(sp);
  const bundle = await requireBundle(slug, {
    from: range.startDate,
    to: range.endDate,
  });
  const model = buildPresentation(bundle, range.label);
  const ch = model.google;
  const ecommerce = model.tenantType === "ecommerce";
  const { current, previous } = bundle;

  const adsCustomerId = resolveAdsCustomerId({
    slug: bundle.tenant.slug,
    name: bundle.tenant.name,
    mapping: bundle.tenant.mapping,
  });

  const live = await loadLiveAdsDetail(
    adsCustomerId,
    range.startDate,
    range.endDate,
  );

  const chartData = ch.campaigns.map((c) => ({
    name: c.campaign.length > 22 ? `${c.campaign.slice(0, 20)}…` : c.campaign,
    harcama: c.spend,
  }));

  const prevByName = new Map(
    previous.campaigns.map((c) => [c.campaign, c] as const),
  );

  const lastCol = ecommerce ? "ROAS" : "CPL";
  const currency = model.currency;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4285F4]">
            Google Ads · {model.typeLabel}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {ch.sectionTitle}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {formatDate(current.from)} – {formatDate(current.to)} · önceki
            dönemle karşılaştırma
          </p>
        </div>
        <StatusBadge status={ch.status} />
      </div>

      <Suspense fallback={null}>
        <PeriodFilterBar label={range.label} />
      </Suspense>

      <ChannelCard channel={ch} currency={model.currency} />

      {ch.status === "unknown" ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          Google Ads verisi alınamadı. Metrikler 0 olarak yazılmadı.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PanelStat
              label="Harcama"
              value={formatTry(current.account.spend, model.currency)}
              hint={
                <Delta
                  value={deltaPct(
                    current.account.spend,
                    previous.account.spend,
                  )}
                  invert
                />
              }
            />
            <PanelStat
              label="Tıklama"
              value={formatNumber(current.account.clicks)}
              hint={
                <Delta
                  value={deltaPct(
                    current.account.clicks,
                    previous.account.clicks,
                  )}
                />
              }
            />
            <PanelStat
              label="Dönüşüm"
              value={formatNumber(current.account.conv, 1)}
              hint={
                <Delta
                  value={deltaPct(current.account.conv, previous.account.conv)}
                />
              }
            />
            {ecommerce ? (
              <PanelStat
                label="Getiri (ROAS)"
                value={`${formatNumber(derivedMetrics(current.account).roas, 2)}x`}
              />
            ) : (
              <PanelStat
                label="CPL"
                value={
                  current.account.conv > 0
                    ? formatTry(
                        derivedMetrics(current.account).cpa,
                        model.currency,
                      )
                    : "—"
                }
              />
            )}
          </div>

          {chartData.length > 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-zinc-800">
                Kampanyalara göre harcama
              </h3>
              <div className="mt-3">
                <CampaignBarChart data={chartData} color="#4285F4" />
              </div>
            </div>
          ) : null}

          <PanelTable
            headers={[
              "Kampanya",
              "Harcama",
              "Gösterim",
              "Tıklama",
              "CTR",
              "Dönüşüm",
              lastCol,
            ]}
          >
            <MetricRow
              label="Hesap toplamı"
              current={current.account}
              previous={previous.account}
              currency={model.currency}
              ecommerce={ecommerce}
            />
            {current.campaigns.map((c) => (
              <MetricRow
                key={c.campaign}
                label={c.campaign}
                current={c}
                previous={prevByName.get(c.campaign)}
                currency={model.currency}
                ecommerce={ecommerce}
              />
            ))}
          </PanelTable>

          {!live.skippedReason ? (
            <div className="space-y-2">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                  Kampanya · kaybedilen gösterim payı (canlı)
                </h4>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Arama ağı · sıralama / bütçe · dönem: {range.label}. Search
                  dışı kampanyalarda — olabilir.
                </p>
              </div>
              {live.campaignShares.error ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
                  {live.campaignShares.error}
                </div>
              ) : live.campaignShares.rows.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Bu dönem için gösterim payı satırı yok.
                </p>
              ) : (
                <PanelTable
                  headers={[
                    "Kampanya",
                    "GP↓ sıra",
                    "Üst GP↓ sıra",
                    "Mutlak GP↓ sıra",
                    "GP↓ bütçe",
                    "Üst GP↓ bütçe",
                    "Mutlak GP↓ bütçe",
                  ]}
                >
                  {live.campaignShares.rows.map((r) => (
                    <tr key={r.campaignId} className="text-zinc-700">
                      <td className="px-3 py-2.5 font-medium text-zinc-900">
                        {r.campaign}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatSharePct(r.rankLostIs)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatSharePct(r.rankLostTopIs)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatSharePct(r.rankLostAbsTopIs)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatSharePct(r.budgetLostIs)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatSharePct(r.budgetLostTopIs)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatSharePct(r.budgetLostAbsTopIs)}
                      </td>
                    </tr>
                  ))}
                </PanelTable>
              )}
            </div>
          ) : null}
        </>
      )}

      <section className="space-y-4 border-t border-zinc-100 pt-6">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">
            Aktif kampanyalar · canlı
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {range.label} · yalnızca ENABLED kampanyalar · sync’e yazılmaz.
            Anahtar kelime / arama terimi çoğunlukla Search kampanyalarında
            dolu; Performance Max’te boş olabilir.
          </p>
        </div>

        {live.skippedReason ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
            {live.skippedReason}
          </div>
        ) : (
          <>
            <LiveBlock
              title="Reklam grupları"
              error={live.adGroups.error}
              empty={!live.adGroups.rows.length}
            >
              <PanelTable
                headers={[
                  "Kampanya",
                  "Grup",
                  "Harcama",
                  "Gösterim",
                  "Tıklama",
                  "Dönüşüm",
                ]}
              >
                {live.adGroups.rows.map((r) => (
                  <tr
                    key={`${r.campaignId}-${r.adGroupId}`}
                    className="text-zinc-700"
                  >
                    <td className="px-3 py-2.5 text-xs text-zinc-600">
                      {r.campaign}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-zinc-900">
                      {r.adGroup}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatTry(r.spend, currency)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatNumber(r.impr)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatNumber(r.clicks)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatNumber(r.conv, 1)}
                    </td>
                  </tr>
                ))}
              </PanelTable>
            </LiveBlock>

            <LiveBlock
              title="Anahtar kelimeler"
              error={live.keywords.error}
              empty={!live.keywords.rows.length}
            >
              <PanelTable
                headers={[
                  "Kelime",
                  "Eşleme",
                  "Kampanya",
                  "Grup",
                  "Harcama",
                  "Tıklama",
                  "Dönüşüm",
                ]}
              >
                {live.keywords.rows.map((r) => (
                  <tr
                    key={`${r.campaignId}-${r.adGroupId}-${r.keyword}-${r.matchType}`}
                    className="text-zinc-700"
                  >
                    <td className="px-3 py-2.5 font-medium text-zinc-900">
                      {r.keyword}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-zinc-500">
                      {matchTypeLabel(r.matchType)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-zinc-600">
                      {r.campaign}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-zinc-600">
                      {r.adGroup}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatTry(r.spend, currency)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatNumber(r.clicks)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatNumber(r.conv, 1)}
                    </td>
                  </tr>
                ))}
              </PanelTable>
            </LiveBlock>

            <LiveBlock
              title="Arama terimleri"
              error={live.searchTerms.error}
              empty={!live.searchTerms.rows.length}
            >
              <PanelTable
                headers={[
                  "Terim",
                  "Kampanya",
                  "Grup",
                  "Harcama",
                  "Tıklama",
                  "Dönüşüm",
                ]}
              >
                {live.searchTerms.rows.map((r) => (
                  <tr
                    key={`${r.campaignId}-${r.adGroupId}-${r.searchTerm}`}
                    className="text-zinc-700"
                  >
                    <td className="px-3 py-2.5 font-medium text-zinc-900">
                      {r.searchTerm}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-zinc-600">
                      {r.campaign}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-zinc-600">
                      {r.adGroup}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatTry(r.spend, currency)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatNumber(r.clicks)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatNumber(r.conv, 1)}
                    </td>
                  </tr>
                ))}
              </PanelTable>
            </LiveBlock>
          </>
        )}
      </section>
    </div>
  );
}

function LiveBlock({
  title,
  error,
  empty,
  children,
}: {
  title: string;
  error: string | null;
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
        {title}
      </h4>
      {error ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          {error}
        </div>
      ) : empty ? (
        <p className="text-sm text-zinc-500">
          Bu dönem / aktif Search kampanyaları için satır yok.
        </p>
      ) : (
        children
      )}
    </div>
  );
}
