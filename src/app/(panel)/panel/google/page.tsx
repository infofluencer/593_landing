import { headers } from "next/headers";
import { ChannelCard } from "@/components/panel/ChannelCard";
import { CampaignBarChart } from "@/components/panel/charts";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { Delta, PanelStat, PanelTable } from "@/components/panel/ui";
import { requireBundle } from "@/lib/panel/data";
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

export default async function GooglePage() {
  const h = await headers();
  const slug = h.get("x-tenant-slug")!;
  const bundle = await requireBundle(slug);
  const model = buildPresentation(bundle);
  const ch = model.google;
  const ecommerce = model.tenantType === "ecommerce";
  const { current, previous } = bundle;

  const chartData = ch.campaigns.map((c) => ({
    name: c.campaign.length > 22 ? `${c.campaign.slice(0, 20)}…` : c.campaign,
    harcama: c.spend,
  }));

  const prevByName = new Map(
    previous.campaigns.map((c) => [c.campaign, c] as const),
  );

  const lastCol = ecommerce ? "ROAS" : "CPL";

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
        </>
      )}
    </div>
  );
}
