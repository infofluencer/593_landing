import { headers } from "next/headers";
import { ChannelCard } from "@/components/panel/ChannelCard";
import { CampaignBarChart } from "@/components/panel/charts";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { PanelStat, PanelTable } from "@/components/panel/ui";
import { requireBundle } from "@/lib/panel/data";
import { buildPresentation } from "@/lib/panel/presentation";
import { derivedMetrics } from "@/lib/panel/mock-data";
import { formatNumber, formatTry } from "@/lib/panel/format";

export default async function MetaPage() {
  const h = await headers();
  const slug = h.get("x-tenant-slug")!;
  const bundle = await requireBundle(slug);
  const model = buildPresentation(bundle);
  const ch = model.meta;
  const ecommerce = model.tenantType === "ecommerce";

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
            Yalnızca ücretli reklam insight’ları — organik Instagram yok
          </p>
        </div>
        <StatusBadge status={ch.status} />
      </div>

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
    </div>
  );
}
