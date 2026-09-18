import {
  ChannelCard,
  ChartCard,
  KPICard,
  StatusBadge,
} from "@/components/panel/ds";
import {
  ConversionPieChart,
  ConvTrendChart,
  MixPieChart,
  SpendTrendChart,
} from "@/components/panel/charts";
import type { PresentationModel } from "@/lib/panel/presentation";
import { formatNumber, formatTry } from "@/lib/panel/format";

export default function PresentationDashboard({
  model,
}: {
  model: PresentationModel;
}) {
  const isLead = model.tenantType !== "ecommerce";
  const chartsEmpty = model.daily.length === 0;
  const mixEmpty = model.mix.every((m) => m.value === 0);
  const convMixEmpty = model.conversionMix.every((m) => m.value === 0);

  const channelHint =
    model.google.status === "unknown" && model.meta.status === "unknown"
      ? null
      : `${model.google.status === "unknown" ? "—" : "Google Ads"} · ${model.meta.status === "unknown" ? "—" : "Meta"}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-panel-accent">
            Marka sunumu · {model.typeLabel}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-panel-fg sm:text-2xl">
            {model.brand}
          </h2>
          <p className="mt-1 text-sm text-panel-fg-secondary">
            Yalnızca bu markanın Meta + Google Ads verileri ·{" "}
            {model.periodLabel}
          </p>
        </div>
        <StatusBadge status={model.health} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          tier={1}
          metricKey="spend"
          kind="money"
          label="Toplam harcama"
          value={formatTry(model.totalSpend, model.currency)}
          goodDirection="down"
          accent="var(--panel-accent)"
          hint={
            <span className="text-xs text-panel-fg-secondary">
              Meta + Google
            </span>
          }
        />
        <KPICard
          tier={1}
          metricKey="conversions"
          kind="count"
          label="Toplam dönüşüm"
          value={formatNumber(model.totalConv, 1)}
          goodDirection="up"
          accent="var(--panel-accent)"
          hint={
            <span className="text-xs text-panel-fg-secondary">
              Düz toplam — örtüşme olabilir (dedupe yok)
            </span>
          }
        />
        {model.totalRevenue != null && !isLead ? (
          <KPICard
            tier={1}
            metricKey="revenue"
            kind="money"
            label="Toplam gelir"
            value={formatTry(model.totalRevenue, model.currency)}
            goodDirection="up"
            accent="var(--panel-accent)"
            hint={
              <span className="text-xs text-panel-fg-secondary">
                Dönüşüm değeri düz toplamı — üst sınır
              </span>
            }
          />
        ) : (
          <KPICard
            tier={1}
            kind="count"
            label="Model"
            value="Lead"
            accent="var(--panel-accent)"
            hint={
              <span className="text-xs text-panel-fg-secondary">
                Gelir / getiri gösterilmez
              </span>
            }
          />
        )}
        <KPICard
          tier={2}
          metricKey="channelsConnected"
          kind={channelHint ? "count" : "unknown"}
          label="Kanallar"
          value={channelHint}
          hint={
            <span className="text-xs text-panel-fg-secondary">
              Eksik kanal = Kontrol edilemedi
            </span>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChannelCard
          channel={model.meta}
          currency={model.currency}
          href="/meta"
        />
        <ChannelCard
          channel={model.google}
          currency={model.currency}
          href="/google"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          title="Haftalık harcama (Meta vs Google)"
          className="lg:col-span-3"
          empty={chartsEmpty}
        >
          <SpendTrendChart data={model.daily} />
        </ChartCard>
        <ChartCard
          title="Bütçe dağılımı"
          className="lg:col-span-2"
          empty={mixEmpty}
          emptyVariant="empty"
        >
          <MixPieChart data={model.mix} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          title="Dönüşüm karşılaştırması"
          className="lg:col-span-3"
          empty={chartsEmpty}
        >
          <ConvTrendChart data={model.daily} />
        </ChartCard>
        <ChartCard
          title="Dönüşüm türleri"
          description="Satış · form · WhatsApp ayrı"
          className="lg:col-span-2"
          empty={convMixEmpty}
          emptyVariant="empty"
        >
          <ConversionPieChart data={model.conversionMix} />
        </ChartCard>
      </div>
    </div>
  );
}
