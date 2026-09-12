import { headers } from "next/headers";
import { Suspense } from "react";
import { ChannelCard } from "@/components/panel/ChannelCard";
import {
  CampaignBarChart,
  MetaDailyChart,
} from "@/components/panel/charts";
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
  type MockMetaAdsetPerformance,
  type MockMetaBreakdownRow,
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
  const thumb = ad.thumbnailUrl || ad.imageUrl;
  const openUrl = ad.permalinkUrl || ad.linkUrl;
  const isActive = ad.effectiveStatus === "ACTIVE";
  return (
    <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
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
        <div className="flex flex-wrap gap-3">
          {ad.permalinkUrl ? (
            <a
              href={ad.permalinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-medium hover:underline"
              style={{ color: META_COLOR }}
            >
              Reklamı aç
            </a>
          ) : null}
          {ad.linkUrl ? (
            <a
              href={ad.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-medium text-zinc-600 hover:underline"
            >
              Hedef site
            </a>
          ) : null}
          {!openUrl ? (
            <span className="text-[12px] text-zinc-400">Link yok</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function BreakdownTable({
  title,
  hint,
  rows,
  kind,
  currency,
  ecommerce,
  resultLabel,
}: {
  title: string;
  hint: string;
  rows: MockMetaBreakdownRow[];
  kind: MockMetaBreakdownRow["breakdown"];
  currency: string;
  ecommerce: boolean;
  resultLabel: string;
}) {
  const filtered = rows
    .filter((r) => r.breakdown === kind)
    .sort((a, b) => b.spend - a.spend);
  if (!filtered.length) return null;
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
        <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>
      </div>
      <PanelTable
        headers={[
          "Kırılım",
          "Harcama",
          "Tıklama",
          resultLabel,
          ecommerce ? "Getiri" : "Maliyet",
        ]}
      >
        {filtered.map((row) => {
          const d = derivedMetrics({
            campaign: row.key,
            spend: row.spend,
            impr: row.impr,
            clicks: row.clicks,
            conv: row.conv,
            convValue: row.convValue,
          });
          return (
            <tr key={`${row.breakdown}-${row.key}`} className="text-zinc-700">
              <td className="px-3 py-2.5 font-medium text-zinc-900">
                {breakdownKeyTr(kind, row.key)}
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
              <td className="px-3 py-2.5 tabular-nums">
                {ecommerce
                  ? row.spend > 0
                    ? `${formatNumber(d.roas, 2)}x`
                    : "—"
                  : row.conv > 0
                    ? formatTry(d.cpa, currency)
                    : "—"}
              </td>
            </tr>
          );
        })}
      </PanelTable>
    </div>
  );
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

  const adsets =
    bundle.metaAdsets.length > 0
      ? bundle.metaAdsets
      : rollupAdsetsFromAds(metaAds);
  const activeAds = metaAds.filter((a) => a.effectiveStatus === "ACTIVE");
  const pastAds = metaAds.filter((a) => a.effectiveStatus !== "ACTIVE");

  const funnel = bundle.metaFunnel;
  const video = bundle.metaVideo;
  const hasFunnel =
    ecommerce &&
    (funnel.viewContent > 0 ||
      funnel.addToCart > 0 ||
      funnel.checkout > 0 ||
      funnel.purchase > 0);
  const hasVideo =
    video.plays > 0 || video.thruplay > 0 || video.p25 > 0 || video.p100 > 0;

  const dailyChart = bundle.metaDaily.map((d) => ({
    label: d.date.slice(5),
    spend: Math.round(d.spend),
    conv: Number(d.conv.toFixed(1)),
  }));

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
    ? ["Kampanya", "Reklam grubu", "Harcama", "Tıklama", resultLabel, "Getiri"]
    : ["Kampanya", "Reklam grubu", "Harcama", "Tıklama", resultLabel, costLabel];

  const funnelMax = Math.max(
    funnel.viewContent,
    funnel.addToCart,
    funnel.checkout,
    funnel.purchase,
    1,
  );

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

          {dailyChart.length > 1 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-zinc-800">
                Günlük harcama & sonuç
              </h3>
              <p className="mt-1 text-[11px] text-zinc-500">
                Seçilen dönem içindeki günlük Meta performansı
              </p>
              <div className="mt-3">
                <MetaDailyChart data={dailyChart} />
              </div>
            </div>
          ) : null}

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
                ).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[11px] text-zinc-500">{label}</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
                      {formatNumber(value)}
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded bg-zinc-100">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${Math.max(4, (value / funnelMax) * 100)}%`,
                          background: META_COLOR,
                        }}
                      />
                    </div>
                  </div>
                ))}
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
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <PanelStat label="Video izleme" value={formatNumber(video.plays)} />
              <PanelStat
                label="ThruPlay"
                value={formatNumber(video.thruplay)}
              />
              <PanelStat label="%25" value={formatNumber(video.p25)} />
              <PanelStat label="%50" value={formatNumber(video.p50)} />
              <PanelStat label="%75" value={formatNumber(video.p75)} />
              <PanelStat label="%100" value={formatNumber(video.p100)} />
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
                    <tr key={row.adsetId} className="text-zinc-700">
                      <td className="px-3 py-2.5 text-xs text-zinc-600">
                        {row.campaignName}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-zinc-900">
                        {row.adsetName}
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
                          {row.conv > 0 ? formatTry(d.cpa, currency) : "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </PanelTable>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-3">
            <BreakdownTable
              title="Yerleşim"
              hint="Facebook / Instagram / Network"
              rows={bundle.metaBreakdowns}
              kind="placement"
              currency={currency}
              ecommerce={ecommerce}
              resultLabel={resultLabel}
            />
            <BreakdownTable
              title="Cihaz"
              hint="Mobil / masaüstü kırılımı"
              rows={bundle.metaBreakdowns}
              kind="device"
              currency={currency}
              ecommerce={ecommerce}
              resultLabel={resultLabel}
            />
            <BreakdownTable
              title="Yaş"
              hint="Hedef kitle yaş dilimleri"
              rows={bundle.metaBreakdowns}
              kind="age"
              currency={currency}
              ecommerce={ecommerce}
              resultLabel={resultLabel}
            />
          </div>
        </>
      )}

      {metaAds.length > 0 ? (
        <div className="space-y-6 border-t border-zinc-100 pt-6">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800">
              Reklam görselleri
            </h3>
            <p className="mt-1 text-[11px] text-zinc-500">
              {activeAds.length} aktif · {pastAds.length} geçmiş ·{" "}
              {metaAds.length} toplam · thumbnail, link ve dönem performansı
            </p>
          </div>

          {activeAds.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Aktif reklamlar
              </h4>
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
          ) : null}

          {pastAds.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Geçmiş / duraklatılmış
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pastAds.map((ad) => (
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
          ) : null}

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
