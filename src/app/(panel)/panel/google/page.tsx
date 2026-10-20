import { headers } from "next/headers";
import { Suspense } from "react";
import BudgetPlanVsActual from "@/components/panel/BudgetPlanVsActual";
import PeriodFilterBar from "@/components/panel/PeriodFilterBar";
import { TimezoneNotice } from "@/components/panel/TimezoneNotice";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { DataTable } from "@/components/panel/ds";
import { DeltaCell } from "@/components/panel/ds/DeltaCell";
import {
  CompareBarChart,
  CompareTrendChart,
  DonutChart,
  LabeledBarChart,
  StatTile,
  type ComparePoint,
} from "@/components/panel/ds/viz";
import { GOOGLE_COLOR, deltaPct } from "@/components/panel/ds/chart-theme";
import { loadBrandBudgetPlan } from "@/lib/panel/brand-budget";
import {
  fetchAdsAdGroups,
  fetchAdsCampaignLostShare,
  fetchAdsKeywords,
  fetchAdsSearchTerms,
  type AdsAdGroupRow,
  type AdsCampaignShareRow,
  type AdsKeywordRow,
  type AdsSearchTermRow,
  type AdsTenantType,
} from "@/lib/integrations/google/ads";
import { useMockPanelData } from "@/lib/integrations/tokens";
import { requireBundle } from "@/lib/panel/data";
import { resolveAdsCustomerId } from "@/lib/panel/google-ads-customer-map";
import { isIntegrationDisabled } from "@/lib/panel/integrations";
import { resolvePanelDateRange } from "@/lib/panel/period";
import {
  bucketSeries,
  buildPresentation,
  type SeriesPoint,
} from "@/lib/panel/presentation";
import { loadTenantStatus } from "@/lib/panel/tenant-status";
import { derivedMetrics } from "@/lib/panel/mock-data";
import { formatConv, formatNumber, formatTry } from "@/lib/panel/format";

function formatSharePct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

type LiveSlice<T> = {
  rows: T[];
  error: string | null;
};

function settledSlice<T>(r: PromiseSettledResult<T[]>): LiveSlice<T> {
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
  tenantType: AdsTenantType,
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
    return { ...empty, skippedReason: "Google Ads hesabı bağlı değil" };
  }

  const [shares, ag, kw, st] = await Promise.allSettled([
    fetchAdsCampaignLostShare({ customerId, from, to }),
    fetchAdsAdGroups({ customerId, from, to, tenantType }),
    fetchAdsKeywords({ customerId, from, to, tenantType }),
    fetchAdsSearchTerms({ customerId, from, to, tenantType }),
  ]);

  return {
    skippedReason: null,
    campaignShares: settledSlice(shares),
    adGroups: settledSlice(ag),
    keywords: settledSlice(kw),
    searchTerms: settledSlice(st),
  };
}

function cmp(
  cur: SeriesPoint[],
  prev: SeriesPoint[],
  key: keyof Omit<SeriesPoint, "label">,
): ComparePoint[] {
  return cur.map((p, i) => ({
    label: p.label,
    current: p[key],
    previous: prev[i] ? prev[i]![key] : null,
  }));
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
  const [bundle, budgetPlan] = await Promise.all([
    requireBundle(slug, { from: range.startDate, to: range.endDate }),
    loadBrandBudgetPlan(slug, { from: range.startDate, to: range.endDate }),
  ]);
  const status = await loadTenantStatus(bundle, budgetPlan);
  const model = buildPresentation(bundle, range.label, status);
  const ch = model.google;
  const ecommerce = model.tenantType === "ecommerce";
  const { current, previous } = bundle;
  const cur = current.account;
  const prev = previous.account;
  const currency = model.currency;
  const unknown = ch.status === "unknown";
  const d = derivedMetrics(cur);
  const dPrev = derivedMetrics(prev);

  const adsCustomerId = resolveAdsCustomerId({
    slug: bundle.tenant.slug,
    name: bundle.tenant.name,
    mapping: bundle.tenant.mapping,
  });
  const adsDisabled = isIntegrationDisabled(bundle.tenant, "google_ads");
  const live = await loadLiveAdsDetail(
    adsDisabled ? null : adsCustomerId,
    range.startDate,
    range.endDate,
    bundle.tenant.type,
  );
  if (adsDisabled) live.skippedReason = "Google Ads bu markada kapalı";

  const series = bucketSeries(bundle.googleDaily ?? [], range.startDate, range.endDate);
  const prevSeries = bucketSeries(
    bundle.prevDaily?.google ?? [],
    previous.from,
    previous.to,
  );

  // Yalnızca yayındaki (ENABLED) kampanyalar — canlı liste varsa ona göre.
  const enabledIds = new Set(
    live.campaignShares.error ? [] : live.campaignShares.rows.map((r) => r.campaignId),
  );
  const campaigns = current.campaigns.filter((c) =>
    enabledIds.size > 0 ? enabledIds.has(c.campaignId ?? "") : c.spend > 0,
  );
  const prevByName = new Map(
    previous.campaigns.map((c) => [c.campaignId ?? c.campaign, c] as const),
  );

  const convActions = bundle.conversions
    .filter((c) => c.source === "Google Ads" && c.primary && !c.dupeFlag)
    .map((c) => ({ name: c.name, value: c.count }));
  const allConv = cur.allConv ?? null;

  const resultLabel = ecommerce ? "Satış" : "Dönüşüm";
  const costLabel = ecommerce ? "Satış maliyeti" : "Lead maliyeti";
  const reasons = ch.reasons;
  const cplDelta = cur.conv > 0 && prev.conv > 0 ? deltaPct(d.cpa, dPrev.cpa) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: GOOGLE_COLOR }}
          >
            Google Ads · {model.typeLabel}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {ch.sectionTitle}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {range.label} · önceki dönemle karşılaştırma
          </p>
        </div>
        <StatusBadge status={ch.status} reasons={reasons} />
      </div>

      <Suspense fallback={null}>
        <PeriodFilterBar label={range.label} />
      </Suspense>

      <TimezoneNotice platform="Google Ads" timeZone={bundle.tenant.mapping.adsTimezone} />

      {reasons.length > 0 && ch.status !== "ok" ? (
        <ul className="space-y-1 rounded-panel-md border border-panel-warn/30 bg-panel-warn-bg px-4 py-3 text-sm text-panel-fg">
          {reasons.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
      ) : null}

      {budgetPlan ? (
        <BudgetPlanVsActual
          plan={budgetPlan}
          provider="google"
          variant="compact"
          statusReasons={status.google.reasons.map((r) => r.text)}
        />
      ) : null}

      {unknown ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          Google Ads verisi şu an alınamıyor. Metrikler 0 olarak yazılmadı.
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <CompareTrendChart
                title="Harcama trendi"
                data={cmp(series, prevSeries, "spend")}
                format="money"
                currency={currency}
                total={cur.spend}
                delta={deltaPct(cur.spend, prev.spend)}
                invert
                variant="navy"
              />
            </div>
            <div className="lg:col-span-2">
              <DonutChart
                title="Dönüşüm türleri"
                data={convActions}
                centerLabel={resultLabel}
                format="count1"
                variant="dark"
                delta={deltaPct(cur.conv, prev.conv)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Harcama"
              value={formatTry(cur.spend, currency)}
              delta={deltaPct(cur.spend, prev.spend)}
              invert
              values={series.map((p) => p.spend)}
              color={GOOGLE_COLOR}
            />
            <StatTile
              label={resultLabel}
              value={formatConv(cur.conv)}
              delta={deltaPct(cur.conv, prev.conv)}
              values={series.map((p) => p.conv)}
              color={GOOGLE_COLOR}
            />
            {ecommerce ? (
              <StatTile
                label="Getiri (ROAS)"
                value={cur.spend > 0 ? `${formatNumber(d.roas, 2)}x` : "—"}
                delta={cur.spend > 0 && prev.spend > 0 ? deltaPct(d.roas, dPrev.roas) : null}
                values={series.map((p) => (p.spend > 0 ? p.convValue / p.spend : 0))}
                color={GOOGLE_COLOR}
              />
            ) : (
              <StatTile
                label={costLabel}
                value={cur.conv > 0 ? formatTry(d.cpa, currency) : "—"}
                delta={cplDelta}
                invert
                values={series.map((p) => (p.conv > 0 ? p.spend / p.conv : 0))}
                color={GOOGLE_COLOR}
              />
            )}
            <StatTile
              label="Tıklama"
              value={formatNumber(cur.clicks)}
              delta={deltaPct(cur.clicks, prev.clicks)}
              values={series.map((p) => p.clicks)}
              color={GOOGLE_COLOR}
            />
            <StatTile
              label="Gösterim"
              value={formatNumber(cur.impr)}
              delta={deltaPct(cur.impr, prev.impr)}
              values={series.map((p) => p.impr)}
              color={GOOGLE_COLOR}
            />
            <StatTile
              label="Tıklama oranı"
              value={`${formatNumber(d.ctr, 2)}%`}
              delta={deltaPct(d.ctr, dPrev.ctr)}
              values={series.map((p) => (p.impr > 0 ? (p.clicks / p.impr) * 100 : 0))}
              color={GOOGLE_COLOR}
            />
            <StatTile
              label="Tıklama maliyeti"
              value={cur.clicks > 0 ? formatTry(d.cpc, currency) : "—"}
              delta={cur.clicks > 0 && prev.clicks > 0 ? deltaPct(d.cpc, dPrev.cpc) : null}
              invert
              values={series.map((p) => (p.clicks > 0 ? p.spend / p.clicks : 0))}
              color={GOOGLE_COLOR}
            />
            {ecommerce ? (
              <StatTile
                label={costLabel}
                value={cur.conv > 0 ? formatTry(d.cpa, currency) : "—"}
                delta={cplDelta}
                invert
                values={series.map((p) => (p.conv > 0 ? p.spend / p.conv : 0))}
                color={GOOGLE_COLOR}
              />
            ) : (
              <StatTile
                label="Tüm dönüşümler"
                value={allConv != null ? formatConv(allConv) : "—"}
                hint="İkincil aksiyonlar dahil · KPI'ya girmez"
              />
            )}
          </div>

          <div className={`grid gap-4 ${campaigns.length > 1 ? "lg:grid-cols-5" : ""}`}>
            <div className={campaigns.length > 1 ? "lg:col-span-3" : ""}>
              <CompareBarChart
                title={`Günlük ${resultLabel.toLowerCase()}`}
                data={cmp(series, prevSeries, "conv")}
                format="count1"
                total={cur.conv}
                delta={deltaPct(cur.conv, prev.conv)}
                variant="dark"
                color={GOOGLE_COLOR}
              />
            </div>
            {campaigns.length > 1 ? (
            <div className="lg:col-span-2">
              <LabeledBarChart
                title="Aktif kampanyalara göre harcama"
                data={campaigns.map((c) => ({ name: c.campaign, value: Math.round(c.spend) }))}
                format="money"
                currency={currency}
                variant="navy"
                color="#8fb3ff"
                layout="horizontal"
                max={8}
              />
            </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div>
              <h3 className="text-sm font-semibold text-zinc-800">
                Aktif kampanyalar
              </h3>
              <p className="mt-1 text-[11px] text-zinc-500">
                Rozetler önceki döneme göre değişimi gösterir · kapalı
                kampanyalar listelenmez
              </p>
            </div>
            {campaigns.length === 0 ? (
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                Bu dönemde aktif kampanya yok.
              </p>
            ) : (
              <DataTable
                headers={[
                  "Kampanya",
                  "Harcama",
                  "Gösterim",
                  "Tıklama",
                  "CTR",
                  resultLabel,
                  ecommerce ? "Getiri" : costLabel,
                ]}
                numericCols={[1, 2, 3, 4, 5, 6]}
              >
                {campaigns.map((c) => {
                  const p = prevByName.get(c.campaignId ?? c.campaign);
                  const cd = derivedMetrics(c);
                  const pd = p ? derivedMetrics(p) : null;
                  return (
                    <tr key={c.campaignId ?? c.campaign}>
                      <td className="font-medium text-panel-fg">{c.campaign}</td>
                      <td className="num">
                        <DeltaCell
                          value={formatTry(c.spend, currency)}
                          delta={p ? deltaPct(c.spend, p.spend) : null}
                          invert
                        />
                      </td>
                      <td className="num">
                        <DeltaCell
                          value={formatNumber(c.impr)}
                          delta={p ? deltaPct(c.impr, p.impr) : null}
                        />
                      </td>
                      <td className="num">
                        <DeltaCell
                          value={formatNumber(c.clicks)}
                          delta={p ? deltaPct(c.clicks, p.clicks) : null}
                        />
                      </td>
                      <td className="num">{formatNumber(cd.ctr, 2)}%</td>
                      <td className="num">
                        <DeltaCell
                          value={formatConv(c.conv)}
                          delta={p ? deltaPct(c.conv, p.conv) : null}
                        />
                      </td>
                      <td className="num">
                        {ecommerce ? (
                          <DeltaCell
                            value={c.spend > 0 ? `${formatNumber(cd.roas, 2)}x` : "—"}
                            delta={pd && c.spend > 0 && p!.spend > 0 ? deltaPct(cd.roas, pd.roas) : null}
                          />
                        ) : (
                          <DeltaCell
                            value={c.conv > 0 ? formatTry(cd.cpa, currency) : "—"}
                            delta={pd && c.conv > 0 && p!.conv > 0 ? deltaPct(cd.cpa, pd.cpa) : null}
                            invert
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            )}
          </div>

          {!live.skippedReason && !live.campaignShares.error && live.campaignShares.rows.length > 0 ? (
            <div className="space-y-2">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">
                  Kampanya · kaybedilen gösterim payı (canlı)
                </h4>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Yalnızca yayındaki arama kampanyaları · sıralama / bütçe
                  nedeniyle kaçan gösterim payı · {range.label}
                </p>
              </div>
              <DataTable
                headers={[
                  "Kampanya",
                  "Sıra · kayıp",
                  "Sıra · üst kayıp",
                  "Sıra · mutlak üst",
                  "Bütçe · kayıp",
                  "Bütçe · üst kayıp",
                  "Bütçe · mutlak üst",
                ]}
                numericCols={[1, 2, 3, 4, 5, 6]}
              >
                {live.campaignShares.rows.map((r) => (
                  <tr key={r.campaignId}>
                    <td className="font-medium text-panel-fg">{r.campaign}</td>
                    <td className="num">{formatSharePct(r.rankLostIs)}</td>
                    <td className="num">{formatSharePct(r.rankLostTopIs)}</td>
                    <td className="num">{formatSharePct(r.rankLostAbsTopIs)}</td>
                    <td className="num">{formatSharePct(r.budgetLostIs)}</td>
                    <td className="num">{formatSharePct(r.budgetLostTopIs)}</td>
                    <td className="num">{formatSharePct(r.budgetLostAbsTopIs)}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
          ) : null}

          {live.skippedReason ? null : (
            <div className="grid gap-4 lg:grid-cols-2">
              <LabeledBarChart
                title="En çok tıklanan anahtar kelimeler"
                data={live.keywords.rows.map((r) => ({ name: r.keyword, value: r.clicks }))}
                variant="dark"
                color={GOOGLE_COLOR}
                layout="horizontal"
                max={10}
              />
              <LabeledBarChart
                title="En çok tıklanan arama terimleri"
                data={live.searchTerms.rows.map((r) => ({ name: r.searchTerm, value: r.clicks }))}
                variant="dark"
                color={GOOGLE_COLOR}
                layout="horizontal"
                max={10}
              />
              <LabeledBarChart
                title="Reklam gruplarına göre harcama"
                data={live.adGroups.rows.map((r) => ({ name: r.adGroup, value: Math.round(r.spend) }))}
                format="money"
                currency={currency}
                variant="light"
                color={GOOGLE_COLOR}
                layout="horizontal"
                max={10}
              />
              <LabeledBarChart
                title="Anahtar kelimelere göre dönüşüm"
                data={live.keywords.rows.map((r) => ({ name: r.keyword, value: Math.round(r.conv * 10) / 10 }))}
                format="count1"
                variant="light"
                color={GOOGLE_COLOR}
                layout="horizontal"
                max={10}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
