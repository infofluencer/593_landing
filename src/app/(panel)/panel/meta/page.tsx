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
import { META_COLOR, deltaPct } from "@/components/panel/ds/chart-theme";
import { loadBrandBudgetPlan } from "@/lib/panel/brand-budget";
import { requireBundle } from "@/lib/panel/data";
import { withMetaPeriodReach } from "@/lib/panel/meta-reach";
import { resolvePanelDateRange } from "@/lib/panel/period";
import {
  bucketSeries,
  buildPresentation,
  type SeriesPoint,
} from "@/lib/panel/presentation";
import { loadTenantStatus } from "@/lib/panel/tenant-status";
import {
  derivedMetrics,
  type MockMetaAdPerformance,
  type MockMetaAdsetPerformance,
  type MockMetaBreakdownRow,
} from "@/lib/panel/mock-data";
import { formatNumber, formatTry } from "@/lib/panel/format";

function statusTr(raw: string): string {
  switch (raw.toUpperCase()) {
    case "ACTIVE":
      return "Aktif";
    case "PAUSED":
      return "Duraklatıldı";
    case "CAMPAIGN_PAUSED":
      return "Kampanya durdu";
    case "ADSET_PAUSED":
      return "Grup durdu";
    case "DISAPPROVED":
      return "Onaylanmadı";
    case "PENDING_REVIEW":
      return "İncelemede";
    case "WITH_ISSUES":
      return "Sorunlu";
    case "DELETED":
    case "ARCHIVED":
      return "Arşiv";
    default:
      return raw || "—";
  }
}

function breakdownKeyTr(
  kind: MockMetaBreakdownRow["breakdown"],
  key: string,
): string {
  if (kind === "placement") {
    const map: Record<string, string> = {
      facebook: "Facebook",
      instagram: "Instagram",
      audience_network: "Audience Network",
      messenger: "Messenger",
      threads: "Threads",
    };
    return map[key] || key;
  }
  if (kind === "device") {
    const map: Record<string, string> = {
      mobile_app: "Mobil uygulama",
      mobile_web: "Mobil web",
      desktop: "Masaüstü",
      unknown: "Bilinmeyen",
    };
    return map[key] || key;
  }
  return key;
}

function rollupAdsetsFromAds(
  ads: MockMetaAdPerformance[],
): MockMetaAdsetPerformance[] {
  const map = new Map<string, MockMetaAdsetPerformance>();
  for (const ad of ads) {
    const adsetName = ad.adsetName || "(reklam grubu yok)";
    const key = `${ad.campaignName}||${adsetName}`;
    const prev = map.get(key) || {
      adsetId: key,
      adsetName,
      campaignName: ad.campaignName || "—",
      spend: 0,
      impr: 0,
      clicks: 0,
      reach: 0,
      conv: 0,
      convValue: 0,
    };
    prev.spend += ad.spend;
    prev.impr += ad.impr;
    prev.clicks += ad.clicks;
    prev.reach += ad.reach;
    prev.conv += ad.conv;
    prev.convValue += ad.convValue;
    map.set(key, prev);
  }
  return [...map.values()].sort((a, b) => b.spend - a.spend);
}

function CreativeCard({
  ad,
  currency,
  ecommerce,
  resultLabel,
  costLabel,
}: {
  ad: MockMetaAdPerformance;
  currency: string;
  ecommerce: boolean;
  resultLabel: string;
  costLabel: string;
}) {
  const d = derivedMetrics({
    campaign: ad.adName,
    spend: ad.spend,
    impr: ad.impr,
    clicks: ad.clicks,
    conv: ad.conv,
    convValue: ad.convValue,
  });
  // Tam boy görsel yoksa 720px küçük resim (senkronda büyük istenir).
  const thumb = ad.imageUrl || ad.thumbnailUrl;
  const publishedUrl = ad.permalinkUrl;
  const destinationUrl = ad.linkUrl;
  return (
    <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="relative aspect-[4/3] bg-zinc-100">
        {thumb ? (
          publishedUrl ? (
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block h-full w-full"
              title="Yayındaki içeriği aç"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumb}
                alt=""
                className="h-full w-full object-cover transition hover:opacity-95"
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
              />
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              loading="lazy"
              decoding="async"
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-400">
            Görsel yok
          </div>
        )}
        <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white">
          {statusTr(ad.effectiveStatus)}
        </span>
      </div>
      <div className="space-y-2 p-3">
        <div>
          {publishedUrl ? (
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="line-clamp-2 text-sm font-medium text-zinc-900 hover:underline"
            >
              {ad.adName}
            </a>
          ) : (
            <p className="line-clamp-2 text-sm font-medium text-zinc-900">
              {ad.adName}
            </p>
          )}
          <p
            className="mt-0.5 line-clamp-2 break-all text-[11px] text-zinc-500"
            title={`${ad.campaignName}${ad.adsetName ? ` · ${ad.adsetName}` : ""}`}
          >
            {ad.campaignName}
            {ad.adsetName ? ` · ${ad.adsetName}` : ""}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
          <div>
            <dt className="text-zinc-500">Harcama</dt>
            <dd className="font-medium tabular-nums text-zinc-900">
              {formatTry(ad.spend, currency)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Tıklama</dt>
            <dd className="font-medium tabular-nums text-zinc-900">
              {formatNumber(ad.clicks)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">{resultLabel}</dt>
            <dd className="font-medium tabular-nums text-zinc-900">
              {formatNumber(ad.conv, 1)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">
              {ecommerce ? "Getiri" : costLabel}
            </dt>
            <dd className="font-medium tabular-nums text-zinc-900">
              {ecommerce
                ? ad.spend > 0
                  ? `${formatNumber(d.roas, 2)}x`
                  : "—"
                : ad.conv > 0
                  ? formatTry(d.cpa, currency)
                  : "—"}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-3">
          {publishedUrl ? (
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-medium hover:underline"
              style={{ color: META_COLOR }}
            >
              Yayında aç
            </a>
          ) : (
            <span className="text-[12px] text-zinc-400">Yayın linki yok</span>
          )}
          {destinationUrl ? (
            <a
              href={destinationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-medium text-zinc-600 hover:underline"
            >
              Hedef site
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
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

function breakdownRows(
  rows: MockMetaBreakdownRow[],
  kind: MockMetaBreakdownRow["breakdown"],
): Array<{ name: string; value: number }> {
  return rows
    .filter((r) => r.breakdown === kind)
    .map((r) => ({ name: breakdownKeyTr(kind, r.key), value: Math.round(r.spend) }));
}

export default async function MetaPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}) {
  const h = await headers();
  const slug = h.get("x-tenant-slug")!;
  const sp = await searchParams;
  const range = await resolvePanelDateRange(sp);
  const [bundle, budgetPlan] = await Promise.all([
    withMetaPeriodReach(
      await requireBundle(slug, { from: range.startDate, to: range.endDate }),
      { from: range.startDate, to: range.endDate },
    ),
    loadBrandBudgetPlan(slug, { from: range.startDate, to: range.endDate }),
  ]);
  const status = await loadTenantStatus(bundle, budgetPlan);
  const model = buildPresentation(bundle, range.label, status);
  const ch = model.meta;
  const ecommerce = model.tenantType === "ecommerce";
  const { metaCurrent, metaPrevious } = bundle;
  const cur = metaCurrent.account;
  const prev = metaPrevious.account;
  const currency = model.currency;
  const unknown = ch.status === "unknown";
  const d = derivedMetrics(cur);
  const dPrev = derivedMetrics(prev);

  const series = bucketSeries(bundle.metaDaily, range.startDate, range.endDate);
  const prevSeries = bucketSeries(
    bundle.prevDaily?.meta ?? [],
    metaPrevious.from,
    metaPrevious.to,
  );

  // Yalnızca yayındaki reklamlar / kampanyalar listelenir.
  const activeAds = bundle.metaAds
    .filter((a) => a.effectiveStatus === "ACTIVE")
    .sort((a, b) => b.spend - a.spend);
  const activeCampaignIds = new Set(
    activeAds.map((a) => a.campaignId).filter((x): x is string => Boolean(x)),
  );
  const activeCampaignNames = new Set(activeAds.map((a) => a.campaignName));
  const hasActiveInfo = activeAds.length > 0;
  const campaigns = metaCurrent.campaigns.filter((c) =>
    hasActiveInfo
      ? (c.campaignId != null && activeCampaignIds.has(c.campaignId)) ||
        activeCampaignNames.has(c.campaign)
      : c.spend > 0,
  );
  const prevByName = new Map(
    metaPrevious.campaigns.map((c) => [c.campaignId ?? c.campaign, c] as const),
  );
  const adsetsAll =
    bundle.metaAdsets.length > 0
      ? bundle.metaAdsets
      : rollupAdsetsFromAds(bundle.metaAds);
  const adsets = adsetsAll.filter((row) =>
    hasActiveInfo ? activeCampaignNames.has(row.campaignName) : row.spend > 0,
  );

  const formLeads = bundle.conversions
    .filter((c) => c.kind === "form" && c.source.toLowerCase().includes("meta"))
    .reduce((s, c) => s + c.count, 0);
  const waLeads = bundle.conversions
    .filter((c) => c.kind === "whatsapp" && c.source.toLowerCase().includes("meta"))
    .reduce((s, c) => s + c.count, 0);

  const funnel = bundle.metaFunnel;
  const video = bundle.metaVideo;
  const hasFunnel =
    ecommerce &&
    (funnel.viewContent > 0 || funnel.addToCart > 0 || funnel.checkout > 0 || funnel.purchase > 0);
  const hasVideo =
    video.plays > 0 || video.thruplay > 0 || video.p25 > 0 || video.p100 > 0;

  const resultLabel = ecommerce ? "Satış" : "Lead";
  const costLabel = ecommerce ? "Satış maliyeti" : "Lead maliyeti";
  const reasons = ch.reasons;

  const cplDelta =
    cur.conv > 0 && prev.conv > 0 ? deltaPct(d.cpa, dPrev.cpa) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: META_COLOR }}
          >
            Meta · Facebook & Instagram · {model.typeLabel}
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

      <TimezoneNotice platform="Meta reklam" timeZone={bundle.tenant.timezone} />

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
          provider="meta"
          variant="compact"
          statusReasons={status.meta.reasons.map((r) => r.text)}
        />
      ) : null}

      {unknown ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          Meta verisi şu an alınamıyor. Rakamlar kasıtlı olarak boş bırakıldı.
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
                title="Yerleşime göre harcama"
                data={breakdownRows(bundle.metaBreakdowns, "placement")}
                centerLabel="Harcama"
                format="money"
                currency={currency}
                variant="dark"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatTile
              label="Harcama"
              value={formatTry(cur.spend, currency)}
              delta={deltaPct(cur.spend, prev.spend)}
              invert
              values={series.map((p) => p.spend)}
              color={META_COLOR}
            />
            <StatTile
              label={resultLabel}
              value={formatNumber(cur.conv, 1)}
              delta={deltaPct(cur.conv, prev.conv)}
              values={series.map((p) => p.conv)}
              color={META_COLOR}
            />
            {ecommerce ? (
              <StatTile
                label="Getiri (ROAS)"
                value={cur.spend > 0 ? `${formatNumber(d.roas, 2)}x` : "—"}
                delta={cur.spend > 0 && prev.spend > 0 ? deltaPct(d.roas, dPrev.roas) : null}
                values={series.map((p) => (p.spend > 0 ? p.convValue / p.spend : 0))}
                color={META_COLOR}
              />
            ) : (
              <StatTile
                label={costLabel}
                value={cur.conv > 0 ? formatTry(d.cpa, currency) : "—"}
                delta={cplDelta}
                invert
                values={series.map((p) => (p.conv > 0 ? p.spend / p.conv : 0))}
                color={META_COLOR}
              />
            )}
            <StatTile
              label="Tıklama"
              value={formatNumber(cur.clicks)}
              delta={deltaPct(cur.clicks, prev.clicks)}
              values={series.map((p) => p.clicks)}
              color={META_COLOR}
            />
            <StatTile
              label="Gösterim"
              value={formatNumber(cur.impr)}
              delta={deltaPct(cur.impr, prev.impr)}
              values={series.map((p) => p.impr)}
              color={META_COLOR}
            />
            <StatTile
              label="Erişim"
              value={cur.reach != null ? formatNumber(cur.reach) : "—"}
              delta={
                cur.reach != null && prev.reach != null
                  ? deltaPct(cur.reach, prev.reach)
                  : null
              }
              values={series.map((p) => p.reach)}
              color={META_COLOR}
            />
            <StatTile
              label="Tıklama oranı"
              value={`${formatNumber(d.ctr, 2)}%`}
              delta={deltaPct(d.ctr, dPrev.ctr)}
              values={series.map((p) => (p.impr > 0 ? (p.clicks / p.impr) * 100 : 0))}
              color={META_COLOR}
            />
            <StatTile
              label="Sıklık"
              value={ch.frequency != null ? formatNumber(ch.frequency, 1) : "—"}
              hint="Bir kişinin reklamı ortalama görme sayısı"
            />
            <StatTile
              label="Tıklama maliyeti"
              value={cur.clicks > 0 ? formatTry(d.cpc, currency) : "—"}
              delta={cur.clicks > 0 && prev.clicks > 0 ? deltaPct(d.cpc, dPrev.cpc) : null}
              invert
              values={series.map((p) => (p.clicks > 0 ? p.spend / p.clicks : 0))}
              color={META_COLOR}
            />
            {ecommerce ? (
              <StatTile
                label={costLabel}
                value={cur.conv > 0 ? formatTry(d.cpa, currency) : "—"}
                delta={cplDelta}
                invert
                values={series.map((p) => (p.conv > 0 ? p.spend / p.conv : 0))}
                color={META_COLOR}
              />
            ) : (
              <>
                <StatTile label="Form lead" value={formatNumber(formLeads)} />
                <StatTile label="WhatsApp lead" value={formatNumber(waLeads)} />
              </>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <CompareBarChart
                title={`Günlük ${resultLabel.toLowerCase()}`}
                data={cmp(series, prevSeries, "conv")}
                format="count1"
                total={cur.conv}
                delta={deltaPct(cur.conv, prev.conv)}
                variant="dark"
                color={META_COLOR}
              />
            </div>
            <div className="lg:col-span-2">
              <DonutChart
                title="Cihaza göre harcama"
                data={breakdownRows(bundle.metaBreakdowns, "device")}
                centerLabel="Harcama"
                format="money"
                currency={currency}
                variant="dark"
              />
            </div>
          </div>

          <div className={`grid gap-4 ${campaigns.length > 1 ? "lg:grid-cols-2" : ""}`}>
            <LabeledBarChart
              title="Yaş gruplarına göre harcama"
              data={breakdownRows(bundle.metaBreakdowns, "age").sort((a, b) =>
                a.name.localeCompare(b.name),
              )}
              format="money"
              currency={currency}
              variant="dark"
              color={META_COLOR}
              max={8}
            />
            {campaigns.length > 1 ? (
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
            ) : null}
          </div>

          {hasFunnel ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-zinc-800">
                Satın alma hunisi
              </h3>
              <p className="mt-1 text-[11px] text-zinc-500">
                Görüntüleme → sepet → ödeme → satış
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                {(
                  [
                    ["Ürün görüntüleme", funnel.viewContent],
                    ["Sepete ekleme", funnel.addToCart],
                    ["Ödeme başlatma", funnel.checkout],
                    ["Satış", funnel.purchase],
                  ] as const
                ).map(([label, value]) => {
                  const max = Math.max(funnel.viewContent, funnel.addToCart, funnel.checkout, funnel.purchase, 1);
                  return (
                    <div key={label}>
                      <p className="text-[11px] text-zinc-500">{label}</p>
                      <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
                        {formatNumber(value)}
                      </p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded bg-zinc-100">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${Math.max(4, (value / max) * 100)}%`,
                            background: META_COLOR,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {funnel.purchaseValue > 0 ? (
                <p className="mt-3 text-[12px] text-zinc-600">
                  Satış cirosu:{" "}
                  <span className="font-medium tabular-nums text-zinc-900">
                    {formatTry(funnel.purchaseValue, currency)}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}

          {hasVideo ? (
            <LabeledBarChart
              title="Video izlenme hunisi"
              data={[
                { name: "Oynatma", value: video.plays },
                { name: "ThruPlay", value: video.thruplay },
                { name: "%25", value: video.p25 },
                { name: "%50", value: video.p50 },
                { name: "%75", value: video.p75 },
                { name: "%100", value: video.p100 },
              ]}
              variant="light"
              color={META_COLOR}
              max={6}
            />
          ) : null}

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
                  "Erişim",
                  "Tıklama",
                  resultLabel,
                  ecommerce ? "Getiri" : costLabel,
                ]}
                numericCols={[1, 2, 3, 4, 5]}
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
                        {c.reach != null ? formatNumber(c.reach) : "—"}
                      </td>
                      <td className="num">
                        <DeltaCell
                          value={formatNumber(c.clicks)}
                          delta={p ? deltaPct(c.clicks, p.clicks) : null}
                        />
                      </td>
                      <td className="num">
                        <DeltaCell
                          value={formatNumber(c.conv, 1)}
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

          {adsets.length > 0 ? (
            <LabeledBarChart
              title="Reklam gruplarına göre harcama"
              data={adsets.map((r) => ({ name: r.adsetName, value: Math.round(r.spend) }))}
              format="money"
              currency={currency}
              variant="light"
              color={META_COLOR}
              layout="horizontal"
              max={10}
            />
          ) : null}
        </>
      )}

      {activeAds.length > 0 ? (
        <div className="space-y-4 border-t border-zinc-100 pt-6">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800">
              Yayındaki reklamlar
            </h3>
            <p className="mt-1 text-[11px] text-zinc-500">
              {activeAds.length} aktif reklam · görsel, bağlantı ve dönem performansı
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeAds.map((ad) => (
              <CreativeCard
                key={ad.adId}
                ad={ad}
                currency={currency}
                ecommerce={ecommerce}
                resultLabel={resultLabel}
                costLabel={costLabel}
              />
            ))}
          </div>
        </div>
      ) : !unknown ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          Şu an yayında reklam yok.
        </div>
      ) : null}

    </div>
  );
}
