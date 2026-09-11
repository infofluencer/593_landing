import { headers } from "next/headers";
import { Suspense } from "react";
import { ChannelCard } from "@/components/panel/ChannelCard";
import { CampaignBarChart } from "@/components/panel/charts";
import PeriodFilterBar from "@/components/panel/PeriodFilterBar";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { PanelStat, PanelTable } from "@/components/panel/ui";
import { requireBundle } from "@/lib/panel/data";
import { resolvePanelDateRange } from "@/lib/panel/period";
import { buildPresentation } from "@/lib/panel/presentation";
import { derivedMetrics } from "@/lib/panel/mock-data";
import { formatNumber, formatTry } from "@/lib/panel/format";

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

  const chartData = ch.campaigns.map((c) => ({
    name: c.campaign.length > 22 ? `${c.campaign.slice(0, 20)}…` : c.campaign,
    harcama: c.spend,
  }));

  const formLeads = bundle.conversions
    .filter((c) => c.kind === "form" && c.source.toLowerCase().includes("meta"))
    .reduce((s, c) => s + c.count, 0);
  const waLeads = bundle.conversions
    .filter(
      (c) => c.kind === "whatsapp" && c.source.toLowerCase().includes("meta"),
    )
    .reduce((s, c) => s + c.count, 0);

  const tableHeaders = ecommerce
    ? ["Kampanya", "Harcama", "Erişim", "Tıklama", "Satış", "ROAS", "CPA"]
    : ["Kampanya", "Harcama", "Erişim", "Tıklama", "Lead", "CPL"];

  const adHeaders = ecommerce
    ? ["Kreatif", "Reklam", "Durum", "Harcama", "Tıklama", "Satış", "ROAS", "Link"]
    : ["Kreatif", "Reklam", "Durum", "Harcama", "Tıklama", "Lead", "CPL", "Link"];

  const activeCount = metaAds.filter((a) => a.effectiveStatus === "ACTIVE").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0668E1]">
            Meta Ads · {model.typeLabel}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {ch.sectionTitle}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Ücretli reklam + kreatifler (BM hesapları) · {range.label}
          </p>
        </div>
        <StatusBadge status={ch.status} />
      </div>

      <Suspense fallback={null}>
        <PeriodFilterBar label={range.label} />
      </Suspense>

      <ChannelCard channel={ch} currency={model.currency} />

      {ch.status !== "unknown" && !ecommerce ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <PanelStat
            label="Form / lead"
            value={formatNumber(formLeads || ch.conv)}
            hint={
              <span className="text-[11px] text-zinc-500">
                Meta lead sonuçları
              </span>
            }
          />
          <PanelStat
            label="WhatsApp"
            value={formatNumber(waLeads)}
            hint={
              <span className="text-[11px] text-zinc-500">
                Mesaj / konuşma — form’dan ayrı
              </span>
            }
          />
        </div>
      ) : null}

      {ch.status !== "unknown" && chartData.length > 0 ? (
        <>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-800">
              Kampanyalara göre harcama
            </h3>
            <div className="mt-3">
              <CampaignBarChart data={chartData} color="#0668E1" />
            </div>
          </div>

          <PanelTable headers={tableHeaders}>
            {ch.campaigns.map((c) => {
              const d = derivedMetrics(c);
              return (
                <tr key={c.campaign} className="text-zinc-700">
                  <td className="px-3 py-2.5 font-medium text-zinc-900">
                    {c.campaign}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatTry(c.spend, model.currency)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {c.reach != null ? formatNumber(c.reach) : "—"}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatNumber(c.clicks)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatNumber(c.conv, 1)}
                  </td>
                  {ecommerce ? (
                    <>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatNumber(d.roas, 2)}x
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {c.conv > 0
                          ? formatTry(d.cpa, model.currency)
                          : "—"}
                      </td>
                    </>
                  ) : (
                    <td className="px-3 py-2.5 tabular-nums">
                      {c.conv > 0 ? formatTry(d.cpa, model.currency) : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </PanelTable>
        </>
      ) : null}

      {metaAds.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-800">
              Reklamlar & kreatifler
            </h3>
            <p className="text-[11px] text-zinc-500">
              {activeCount} aktif · {metaAds.length} kayıt · dönem performansına
              göre sıralı
            </p>
          </div>
          <PanelTable headers={adHeaders}>
            {metaAds.map((ad) => {
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
              return (
                <tr key={ad.adId} className="text-zinc-700">
                  <td className="px-3 py-2.5">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-md object-cover bg-zinc-100"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-zinc-100 text-[10px] text-zinc-400">
                        yok
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-zinc-900">{ad.adName}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {ad.campaignName}
                      {ad.adsetName ? ` · ${ad.adsetName}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={
                        ad.effectiveStatus === "ACTIVE"
                          ? "text-[11px] font-medium text-emerald-700"
                          : "text-[11px] text-zinc-500"
                      }
                    >
                      {ad.effectiveStatus || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatTry(ad.spend, model.currency)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatNumber(ad.clicks)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {formatNumber(ad.conv, 1)}
                  </td>
                  {ecommerce ? (
                    <td className="px-3 py-2.5 tabular-nums">
                      {ad.spend > 0 ? `${formatNumber(d.roas, 2)}x` : "—"}
                    </td>
                  ) : (
                    <td className="px-3 py-2.5 tabular-nums">
                      {ad.conv > 0 ? formatTry(d.cpa, model.currency) : "—"}
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    {openUrl ? (
                      <a
                        href={openUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] font-medium text-[#0668E1] hover:underline"
                      >
                        {ad.permalinkUrl ? "Önizleme" : "Hedef"}
                      </a>
                    ) : (
                      <span className="text-[12px] text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </PanelTable>
          <p className="text-[11px] text-zinc-500">
            Yalnızca bu reklam hesabında / BM’de paylaşılan reklamlar görünür.
            Başka hesapta, paylaşılmadan yayınlanan reklamlar Marketing API ile
            gelmez.
          </p>
        </div>
      ) : null}
    </div>
  );
}
