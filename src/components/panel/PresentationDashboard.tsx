import type { ReactNode } from "react";
import { ChannelCard, StatusBadge } from "@/components/panel/ds";
import {
  CompareBarChart,
  CompareTrendChart,
  DonutChart,
  LabeledBarChart,
  StatTile,
  type ComparePoint,
} from "@/components/panel/ds/viz";
import { GOOGLE_COLOR, META_COLOR, deltaPct } from "@/components/panel/ds/chart-theme";
import type { PresentationModel, SeriesPoint } from "@/lib/panel/presentation";
import { formatNumber, formatTry } from "@/lib/panel/format";

/** Bu dönem / önceki dönem kovalarını aynı sırada eşler. */
export function comparePoints(
  current: SeriesPoint[],
  previous: SeriesPoint[],
  key: keyof Omit<SeriesPoint, "label">,
): ComparePoint[] {
  return current.map((p, i) => ({
    label: p.label,
    current: p[key],
    previous: previous[i] ? previous[i]![key] : null,
  }));
}

export function seriesValues(
  points: SeriesPoint[],
  key: keyof Omit<SeriesPoint, "label">,
): number[] {
  return points.map((p) => p[key]);
}

/**
 * Marka sunumu — grafik öncelikli: trend (bu dönem vs önceki), dağılım
 * halkaları, delta rozetli KPI kutuları, kampanya barı. Tablolar yok.
 */
export default function PresentationDashboard({
  model,
  budget,
}: {
  model: PresentationModel;
  /** Bütçe özeti (Planlanan / Harcanan / Kalan) — sayfa verir. */
  budget?: ReactNode;
}) {
  const isLead = model.tenantType !== "ecommerce";
  const cur = model.currency;
  const s = model.series;
  const ps = model.prevSeries;
  const bothUnknown =
    model.google.status === "unknown" && model.meta.status === "unknown";

  const spendDelta = deltaPct(model.totalSpend, model.prev.spend);
  const convDelta = deltaPct(model.totalConv, model.prev.conv);
  const cpl = model.totalConv > 0 ? model.totalSpend / model.totalConv : null;
  const prevCpl = model.prev.conv > 0 ? model.prev.spend / model.prev.conv : null;
  const cplDelta = cpl != null && prevCpl != null ? deltaPct(cpl, prevCpl) : null;
  const ctr = model.totalImpr > 0 ? (model.totalClicks / model.totalImpr) * 100 : 0;
  const prevCtr = model.prev.impr > 0 ? (model.prev.clicks / model.prev.impr) * 100 : 0;
  const revenueDelta =
    model.totalRevenue != null && model.prev.revenue != null
      ? deltaPct(model.totalRevenue, model.prev.revenue)
      : null;

  const resultLabel = isLead ? "Lead" : "Satış";
  const campaignRows = [...model.google.campaigns, ...model.meta.campaigns]
    .filter((c) => c.spend > 0)
    .map((c) => ({ name: c.campaign, value: Math.round(c.spend) }));

  const cplSeries = s.map((p) => (p.conv > 0 ? p.spend / p.conv : 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-panel-accent">
            Marka sunumu · {model.typeLabel}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-panel-fg sm:text-2xl">
            {model.brand}
          </h2>
          <p className="mt-1 text-sm text-panel-fg-secondary">
            Meta + Google Ads · {model.periodLabel} · önceki dönemle karşılaştırma
          </p>
        </div>
        <StatusBadge status={model.health} reasons={model.healthReasons} />
      </div>

      {model.healthReasons.length > 0 && model.health !== "ok" ? (
        <ul className="space-y-1 rounded-panel-md border border-panel-warn/30 bg-panel-warn-bg px-4 py-3 text-sm text-panel-fg">
          {model.healthReasons.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CompareTrendChart
            title="Toplam harcama trendi"
            data={comparePoints(s, ps, "spend")}
            format="money"
            currency={cur}
            total={bothUnknown ? null : model.totalSpend}
            delta={spendDelta}
            invert
            variant="navy"
          />
        </div>
        <div className="lg:col-span-2">
          <DonutChart
            title="Bütçe dağılımı"
            data={[
              { name: "Meta", value: model.meta.status === "unknown" ? 0 : model.meta.spend, color: META_COLOR },
              { name: "Google Ads", value: model.google.status === "unknown" ? 0 : model.google.spend, color: GOOGLE_COLOR },
            ]}
            centerLabel="Harcama"
            format="money"
            currency={cur}
            variant="dark"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          label="Toplam harcama"
          value={bothUnknown ? null : formatTry(model.totalSpend, cur)}
          delta={spendDelta}
          invert
          values={seriesValues(s, "spend")}
        />
        <StatTile
          label={`Toplam ${resultLabel.toLowerCase()}`}
          value={bothUnknown ? null : formatNumber(model.totalConv, isLead ? 0 : 0)}
          delta={convDelta}
          values={seriesValues(s, "conv")}
        />
        <StatTile
          label={isLead ? "Lead maliyeti" : "Satış maliyeti"}
          value={bothUnknown ? null : cpl != null ? formatTry(cpl, cur) : "—"}
          delta={cplDelta}
          invert
          values={cplSeries}
        />
        <StatTile
          label="Tıklama"
          value={bothUnknown ? null : formatNumber(model.totalClicks)}
          delta={deltaPct(model.totalClicks, model.prev.clicks)}
          values={seriesValues(s, "clicks")}
        />
        <StatTile
          label="Gösterim"
          value={bothUnknown ? null : formatNumber(model.totalImpr)}
          delta={deltaPct(model.totalImpr, model.prev.impr)}
          values={seriesValues(s, "impr")}
        />
        {isLead || model.totalRevenue == null ? (
          <StatTile
            label="Tıklama oranı"
            value={bothUnknown ? null : `${formatNumber(ctr, 2)}%`}
            delta={deltaPct(ctr, prevCtr)}
            values={s.map((p) => (p.impr > 0 ? (p.clicks / p.impr) * 100 : 0))}
          />
        ) : (
          <StatTile
            label="Toplam gelir"
            value={formatTry(model.totalRevenue, cur)}
            delta={revenueDelta}
            values={seriesValues(s, "convValue")}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CompareBarChart
            title={`Günlük ${resultLabel.toLowerCase()}`}
            data={comparePoints(s, ps, "conv")}
            format="count1"
            total={bothUnknown ? null : model.totalConv}
            delta={convDelta}
            variant="dark"
          />
        </div>
        <div className="lg:col-span-2">
          <DonutChart
            title={isLead ? "Dönüşüm türleri" : "Satış kaynağı"}
            data={
              isLead
                ? model.conversionMix.map((m) => ({ name: m.name, value: m.value }))
                : [
                    { name: "Meta", value: model.meta.conv, color: META_COLOR },
                    { name: "Google Ads", value: model.google.conv, color: GOOGLE_COLOR },
                  ]
            }
            centerLabel={resultLabel}
            format="count1"
            variant="dark"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChannelCard channel={model.meta} currency={cur} href="/meta" />
        <ChannelCard channel={model.google} currency={cur} href="/google" />
      </div>

      {/* Tek kampanyada bar grafiği anlamsız — yalnızca bütçe özeti kalır. */}
      <div className={`grid gap-4 ${budget && campaignRows.length > 1 ? "lg:grid-cols-2" : ""}`}>
        {campaignRows.length > 1 ? (
          <LabeledBarChart
            title="Kampanyalara göre harcama"
            data={campaignRows}
            format="money"
            currency={cur}
            layout="horizontal"
            variant="navy"
            color="#8fb3ff"
            max={8}
          />
        ) : null}
        {budget}
      </div>
    </div>
  );
}
