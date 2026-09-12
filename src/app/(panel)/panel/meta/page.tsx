import { headers } from "next/headers";
import { Suspense } from "react";
import { ChannelCard } from "@/components/panel/ChannelCard";
import { CampaignBarChart } from "@/components/panel/charts";
import PeriodFilterBar from "@/components/panel/PeriodFilterBar";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { Delta, PanelStat, PanelTable } from "@/components/panel/ui";
import { requireBundle } from "@/lib/panel/data";
import { resolvePanelDateRange } from "@/lib/panel/period";
import {
  CHANNEL_BRAND,
  buildPresentation,
} from "@/lib/panel/presentation";
import {
  deltaPct,
  derivedMetrics,
  type MockCampaignMetric,
  type MockMetaAdPerformance,
} from "@/lib/panel/mock-data";
import { formatNumber, formatTry } from "@/lib/panel/format";

const META_COLOR = CHANNEL_BRAND.meta;

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
      <td className="px-3 py-2.5 tabular-nums">
        {current.reach != null ? formatNumber(current.reach) : "—"}
      </td>
      <td className="px-3 py-2.5 tabular-nums">
        {formatNumber(current.impr)}
      </td>
      <td className="px-3 py-2.5 tabular-nums">
        {formatNumber(current.clicks)}
      </td>
      <td className="px-3 py-2.5 tabular-nums">
        {formatNumber(c.ctr, 2)}%
      </td>
      <td className="px-3 py-2.5 tabular-nums">
        {formatNumber(current.conv, 1)}
      </td>
      {ecommerce ? (
        <>
          <td className="px-3 py-2.5 tabular-nums">
            {current.spend > 0 ? `${formatNumber(c.roas, 2)}x` : "—"}
          </td>
          <td className="px-3 py-2.5 tabular-nums">
            {current.conv > 0 ? formatTry(c.cpa, currency) : "—"}
          </td>
        </>
      ) : (
        <td className="px-3 py-2.5 tabular-nums">
          {current.conv > 0 ? formatTry(c.cpa, currency) : "—"}
        </td>
      )}
    </tr>
  );
}

type AdsetRollup = {
  key: string;
  campaignName: string;
  adsetName: string;
  spend: number;
  impr: number;
  clicks: number;
  reach: number;
  conv: number;
  convValue: number;
  ads: number;
};

function rollupAdsets(ads: MockMetaAdPerformance[]): AdsetRollup[] {
  const map = new Map<string, AdsetRollup>();
  for (const ad of ads) {
    const adsetName = ad.adsetName || "(reklam grubu yok)";
    const key = `${ad.campaignName}||${adsetName}`;
    const prev = map.get(key) || {
      key,
      campaignName: ad.campaignName || "—",
      adsetName,
      spend: 0,
      impr: 0,
      clicks: 0,
      reach: 0,
      conv: 0,
      convValue: 0,
      ads: 0,
    };
    prev.spend += ad.spend;
    prev.impr += ad.impr;
    prev.clicks += ad.clicks;
    prev.reach += ad.reach;
    prev.conv += ad.conv;
    prev.convValue += ad.convValue;
    prev.ads += 1;
    map.set(key, prev);
  }
  return [...map.values()].sort((a, b) => b.spend - a.spend);
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
  const bundle = await requireBundle(slug, {
    from: range.startDate,
    to: range.endDate,
  });
  const model = buildPresentation(bundle, range.label);
  const ch = model.meta;
  const ecommerce = model.tenantType === "ecommerce";
  const metaAds = bundle.metaAds;
  const { metaCurrent, metaPrevious } = bundle;
  const currency = model.currency;

  const chartData = ch.campaigns.map((c) => ({
    name: c.campaign.length > 22 ? `${c.campaign.slice(0, 20)}…` : c.campaign,
    harcama: c.spend,
  }));

  const prevByName = new Map(
    metaPrevious.campaigns.map((c) => [c.campaign, c] as const),
  );

  const formLeads = bundle.conversions
    .filter((c) => c.kind === "form" && c.source.toLowerCase().includes("meta"))
    .reduce((s, c) => s + c.count, 0);
  const waLeads = bundle.conversions
    .filter(
      (c) => c.kind === "whatsapp" && c.source.toLowerCase().includes("meta"),
    )
    .reduce((s, c) => s + c.count, 0);

  const adsets = rollupAdsets(metaAds);
  const activeCount = metaAds.filter(
    (a) => a.effectiveStatus === "ACTIVE",
  ).length;
  const topCreatives = [...metaAds]
    .filter((a) => a.spend > 0 || a.effectiveStatus === "ACTIVE")
    .slice(0, 12);

  const resultLabel = ecommerce ? "Satış" : "Lead";
  const costLabel = ecommerce ? "Satış maliyeti" : "Lead maliyeti";

  const campaignHeaders = ecommerce
    ? [
        "Kampanya",
        "Harcama",
        "Erişim",
        "Gösterim",
        "Tıklama",
        "Tıklama %",
        resultLabel,
        "Getiri",
        costLabel,
      ]
    : [
        "Kampanya",
        "Harcama",
        "Erişim",
        "Gösterim",
        "Tıklama",
        "Tıklama %",
        resultLabel,
        costLabel,
      ];

  const adsetHeaders = ecommerce
    ? ["Kampanya", "Reklam grubu", "Reklam", "Harcama", "Tıklama", resultLabel, "Getiri"]
    : ["Kampanya", "Reklam grubu", "Reklam", "Harcama", "Tıklama", resultLabel, costLabel];

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
            Seçilen dönem: {range.label} · önceki dönemle karşılaştırma
          </p>
        </div>
        <StatusBadge status={ch.status} />
      </div>

      <Suspense fallback={null}>
        <PeriodFilterBar label={range.label} />
      </Suspense>

      <ChannelCard channel={ch} currency={currency} />

      {ch.status === "unknown" ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          Meta verisi alınamadı. Rakamlar kasıtlı olarak boş bırakıldı.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PanelStat
              label="Harcama"
              value={formatTry(metaCurrent.account.spend, currency)}
              hint={
                <Delta
                  value={deltaPct(
                    metaCurrent.account.spend,
                    metaPrevious.account.spend,
                  )}
                  invert
                />
              }
            />
            <PanelStat
              label="Tıklama"
              value={formatNumber(metaCurrent.account.clicks)}
              hint={
                <Delta
                  value={deltaPct(
                    metaCurrent.account.clicks,
                    metaPrevious.account.clicks,
                  )}
                />
              }
            />
            <PanelStat
              label={resultLabel}
              value={formatNumber(metaCurrent.account.conv, 1)}
              hint={
                <Delta
                  value={deltaPct(
                    metaCurrent.account.conv,
                    metaPrevious.account.conv,
                  )}
                />
              }
            />
            {ecommerce ? (
              <PanelStat
                label="Getiri"
                value={`${formatNumber(derivedMetrics(metaCurrent.account).roas, 2)}x`}
                hint={
                  <span className="text-[11px] text-zinc-500">
                    1 TL harcamaya karşılık ciro
                  </span>
                }
              />
            ) : (
              <PanelStat
                label={costLabel}
                value={
                  metaCurrent.account.conv > 0
                    ? formatTry(
                        derivedMetrics(metaCurrent.account).cpa,
                        currency,
                      )
                    : "—"
                }
                hint={
                  <span className="text-[11px] text-zinc-500">
                    Bir sonuç için ortalama maliyet
                  </span>
                }
              />
            )}
          </div>

          {!ecommerce ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <PanelStat
                label="Form / iletişim"
                value={formatNumber(formLeads || ch.conv)}
                hint={
                  <span className="text-[11px] text-zinc-500">
                    Form doldurma ve benzeri sonuçlar
                  </span>
                }
              />
              <PanelStat
                label="WhatsApp"
                value={formatNumber(waLeads)}
                hint={
                  <span className="text-[11px] text-zinc-500">
                    Mesaj / konuşma — formdan ayrı
                  </span>
                }
              />
            </div>
          ) : null}

          {chartData.length > 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-zinc-800">
                Kampanyalara göre harcama
              </h3>
              <p className="mt-1 text-[11px] text-zinc-500">
                Hangi kampanyaya ne kadar bütçe gittiği
              </p>
              <div className="mt-3">
                <CampaignBarChart data={chartData} color={META_COLOR} />
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <div>
              <h3 className="text-sm font-semibold text-zinc-800">
                Kampanya performansı
              </h3>
              <p className="mt-1 text-[11px] text-zinc-500">
                Altındaki küçük oklar önceki döneme göre değişimi gösterir
              </p>
            </div>
            <PanelTable headers={campaignHeaders}>
              <MetricRow
                label="Toplam"
                current={metaCurrent.account}
                previous={metaPrevious.account}
                currency={currency}
                ecommerce={ecommerce}
              />
              {metaCurrent.campaigns.map((c) => (
                <MetricRow
                  key={c.campaign}
                  label={c.campaign}
                  current={c}
                  previous={prevByName.get(c.campaign)}
                  currency={currency}
                  ecommerce={ecommerce}
                />
              ))}
            </PanelTable>
          </div>

          {adsets.length > 0 ? (
            <div className="space-y-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-800">
                  Reklam grupları
                </h3>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Kampanya içindeki hedef kitle / yerleşim grupları
                </p>
              </div>
              <PanelTable headers={adsetHeaders}>
                {adsets.map((row) => {
                  const d = derivedMetrics({
                    campaign: row.adsetName,
                    spend: row.spend,
                    impr: row.impr,
                    clicks: row.clicks,
                    conv: row.conv,
                    convValue: row.convValue,
                  });
                  return (
                    <tr key={row.key} className="text-zinc-700">
                      <td className="px-3 py-2.5 text-xs text-zinc-600">
                        {row.campaignName}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-zinc-900">
                        {row.adsetName}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatNumber(row.ads)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatTry(row.spend, currency)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatNumber(row.clicks)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatNumber(row.conv, 1)}
                      </td>
                      {ecommerce ? (
                        <td className="px-3 py-2.5 tabular-nums">
                          {row.spend > 0
                            ? `${formatNumber(d.roas, 2)}x`
                            : "—"}
                        </td>
                      ) : (
                        <td className="px-3 py-2.5 tabular-nums">
                          {row.conv > 0
                            ? formatTry(d.cpa, currency)
                            : "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </PanelTable>
            </div>
          ) : null}
        </>
      )}

      {topCreatives.length > 0 ? (
        <div className="space-y-3 border-t border-zinc-100 pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-zinc-800">
                Reklam görselleri
              </h3>
              <p className="mt-1 text-[11px] text-zinc-500">
                {activeCount} aktif · {metaAds.length} reklam · harcamaya göre
                sıralı
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topCreatives.map((ad) => {
              const d = derivedMetrics({
                campaign: ad.adName,
                spend: ad.spend,
                impr: ad.impr,
                clicks: ad.clicks,
                conv: ad.conv,
                convValue: ad.convValue,
              });
              const thumb = ad.thumbnailUrl || ad.imageUrl;
              const openUrl = ad.permalinkUrl || ad.linkUrl;
              const isActive = ad.effectiveStatus === "ACTIVE";
              return (
                <article
                  key={ad.adId}
                  className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
                >
                  <div className="relative aspect-[4/3] bg-zinc-100">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                        Görsel yok
                      </div>
                    )}
                    <span
                      className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-medium ${
                        isActive
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-800/80 text-white"
                      }`}
                    >
                      {statusTr(ad.effectiveStatus)}
                    </span>
                  </div>
                  <div className="space-y-2 p-3">
                    <div>
                      <p className="line-clamp-2 text-sm font-medium text-zinc-900">
                        {ad.adName}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">
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
                    {openUrl ? (
                      <a
                        href={openUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-[12px] font-medium hover:underline"
                        style={{ color: META_COLOR }}
                      >
                        {ad.permalinkUrl ? "Reklamı aç" : "Hedef siteyi aç"}
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          <p className="text-[11px] text-zinc-500">
            Yalnızca bu reklam hesabında görünen reklamlar listelenir. Başka
            hesapta, paylaşılmadan yayınlananlar buraya gelmez.
          </p>
        </div>
      ) : ch.status !== "unknown" ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          Bu dönem için reklam / görsel kaydı yok. Meta sync sonrası kreatifler
          burada görünür.
        </div>
      ) : null}
    </div>
  );
}
