"use client";

/**
 * Adım 2 önizleme — bileşen kütüphanesi (metrik kalıplarına bağlı).
 */
import { Suspense } from "react";
import {
  BudgetBar,
  ChannelCard,
  ChartCard,
  DataTable,
  DateRangePicker,
  EmptyState,
  FunnelCard,
  KPICard,
  MetricCell,
  SectionCard,
  StatusBadge,
} from "@/components/panel/ds";
import type { ChannelView } from "@/lib/panel/presentation";
import { formatNumber, formatTry } from "@/lib/panel/format";
import { formatDurationMmSs } from "@/lib/panel/metric-kinds";

const demoMeta: ChannelView = {
  id: "meta",
  label: "Meta",
  short: "Meta",
  sectionTitle: "Facebook & Instagram",
  color: "#0866FF",
  status: "ok",
  tenantType: "ecommerce",
  spend: 72100,
  clicks: 18420,
  impr: 890000,
  reach: 412000,
  frequency: 2.1,
  conv: 418,
  convValue: 245000,
  ctr: 2.07,
  cpc: 3.9,
  costPerResult: 172,
  costPerResultLabel: "Satış maliyeti",
  roas: 3.4,
  showRoas: true,
  showRevenue: true,
  prevSpend: 64000,
  prevConv: 390,
  spendDelta: 12.7,
  convDelta: 7.2,
  campaigns: [],
};

const demoGoogle: ChannelView = {
  ...demoMeta,
  id: "google",
  label: "Google Ads",
  short: "Google",
  sectionTitle: "Arama & Performance Max",
  color: "#4285F4",
  status: "warn",
  statusNote: "CPA eşik üstü — inceleme önerilir.",
  spend: 56300,
  clicks: 12100,
  impr: 410000,
  reach: null,
  frequency: null,
  conv: 312,
  convValue: 198000,
  ctr: 2.95,
  cpc: 4.65,
  costPerResult: 180,
  roas: 3.52,
  spendDelta: 4.1,
  convDelta: -2.3,
  campaigns: [],
};

export default function DesignSystemPreview() {
  return (
    <div className="space-y-10">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-panel-accent">
          KPI hiyerarşi · Adım 1
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-panel-fg">
          Sözlük + tier + (?) tooltip
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-panel-fg-secondary">
          metric-descriptions merkezi. KPICard tier 1/2/3. Etiket yanında (?) —
          hover/focus/tap ile açıklama + formül.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-panel-fg">
          Tier 1 · Kuzey yıldızı
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard
            tier={1}
            metricKey="spend"
            kind="money"
            value={formatTry(128450)}
            delta={12.4}
            goodDirection="down"
            accent="var(--panel-meta)"
          />
          <KPICard
            tier={1}
            metricKey="conversions"
            kind="count"
            value={formatNumber(842)}
            delta={3.1}
            goodDirection="up"
            accent="var(--panel-meta)"
          />
          <KPICard
            tier={1}
            metricKey="cpl"
            kind="money"
            value={formatTry(152)}
            delta={-4.2}
            goodDirection="down"
            accent="var(--panel-meta)"
          />
          <KPICard
            tier={1}
            metricKey="roas"
            kind="multiplier"
            value={`${formatNumber(3.41, 2)}x`}
            delta={5.2}
            goodDirection="up"
            accent="var(--panel-meta)"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-panel-fg">
          Tier 2 · Destekleyici
        </h3>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <KPICard
            tier={2}
            metricKey="impressions"
            kind="count"
            value={formatNumber(890000)}
          />
          <KPICard
            tier={2}
            metricKey="reach"
            kind="count"
            value={formatNumber(412000)}
          />
          <KPICard
            tier={2}
            metricKey="ctr"
            kind="rate"
            value={`${formatNumber(2.07, 2)}%`}
            delta={0.4}
            goodDirection="up"
          />
          <KPICard
            tier={2}
            metricKey="clicks"
            kind="count"
            value={formatNumber(18420)}
          />
          <KPICard
            tier={2}
            metricKey="frequency"
            kind="count"
            value={formatNumber(2.1, 1)}
          />
          <KPICard
            tier={2}
            metricKey="cpc"
            kind="money"
            value={formatTry(3.9)}
            goodDirection="down"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-panel-fg">
          Tier 3 · Detay (kompakt)
        </h3>
        <div className="grid gap-2 sm:grid-cols-4 xl:grid-cols-6">
          <KPICard tier={3} metricKey="videoP25" kind="count" value="12.4k" />
          <KPICard tier={3} metricKey="videoP50" kind="count" value="8.1k" />
          <KPICard tier={3} metricKey="videoP75" kind="count" value="4.2k" />
          <KPICard tier={3} metricKey="thruplay" kind="count" value="3.0k" />
          <KPICard
            tier={3}
            metricKey="avgSessionDuration"
            kind="duration"
            value={formatDurationMmSs(204)}
          />
          <KPICard
            tier={3}
            kind="unknown"
            label="Bilinmeyen"
            value={null}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-panel-fg">KPICard · kind (eski)</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard
            kind="money"
            label="Harcama"
            value={formatTry(128450)}
            delta={12.4}
            goodDirection="down"
          />
          <KPICard
            kind="count"
            label="Dönüşüm"
            value={formatNumber(842)}
            delta={3.1}
            goodDirection="up"
          />
          <KPICard
            kind="multiplier"
            label="Getiri"
            value={`${formatNumber(3.41, 2)}x`}
            delta={5.2}
            goodDirection="up"
          />
          <KPICard
            kind="duration"
            label="Ort. oturum"
            value={formatDurationMmSs(204)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-panel-fg">
          ChannelCard (Meta + Google)
        </h3>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChannelCard channel={demoMeta} currency="TRY" href="/meta" />
          <ChannelCard channel={demoGoogle} currency="TRY" href="/google" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-panel-fg">FunnelCard</h3>
          <FunnelCard
            currencyNote="E-ticaret · örnek"
            steps={[
              { id: "view", label: "Ürün görüntüleme", value: 42000 },
              { id: "cart", label: "Sepete ekleme", value: 6800 },
              { id: "checkout", label: "Ödeme başlatma", value: 2100 },
              {
                id: "purchase",
                label: "Satış",
                value: 730,
                subValue: formatTry(245000),
              },
            ]}
          />
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-panel-fg">BudgetBar</h3>
          <BudgetBar
            realized={128450}
            target={200000}
            currency="TRY"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-panel-fg">
          SectionCard · MetricCell · Status
        </h3>
        <SectionCard
          title="Örnek bölüm"
          provider="ga4"
          status="ok"
          description="Provider etiketi + durum rozeti"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCell
              kind="count"
              label="Kullanıcı"
              value={formatNumber(12400)}
            />
            <MetricCell
              kind="rate"
              label="Hemen çıkma"
              value={`${formatNumber(42.1, 1)}%`}
              goodDirection="down"
              delta={-1.2}
            />
            <MetricCell kind="duration" label="Süre" value="3:24" />
            <MetricCell kind="money" label="Gelir" value={null} />
          </div>
        </SectionCard>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="ok" />
          <StatusBadge status="warn" />
          <StatusBadge status="critical" />
          <StatusBadge status="unknown" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-panel-fg">DataTable</h3>
          <DataTable
            headers={[
              { key: "campaign", label: "Kampanya", metricKey: "campaign" },
              { key: "spend", label: "Harcama", metricKey: "spend" },
              {
                key: "conv",
                label: "Dönüşüm",
                metricKey: "conversions",
              },
              { key: "cpa", label: "CPA", metricKey: "cpa" },
            ]}
            numericCols={[1, 2, 3]}
          >
            <tr data-total>
              <td>Toplam</td>
              <td className="num">{formatTry(35240)}</td>
              <td className="num">214</td>
              <td className="num">{formatTry(165)}</td>
            </tr>
            <tr>
              <td>Prospecting</td>
              <td className="num">{formatTry(24200)}</td>
              <td className="num">118</td>
              <td className="num">{formatTry(205)}</td>
            </tr>
            <tr>
              <td>Retargeting</td>
              <td className="num">{formatTry(11040)}</td>
              <td className="num">96</td>
              <td className="num">{formatTry(115)}</td>
            </tr>
          </DataTable>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-panel-fg">
            ChartCard · EmptyState
          </h3>
          <ChartCard title="Haftalık harcama" empty emptyVariant="unknown" />
          <EmptyState variant="empty" />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-panel-fg">DateRangePicker</h3>
        <div className="rounded-panel-lg border border-panel-border bg-panel-surface p-6 shadow-panel">
          <Suspense fallback={null}>
            <DateRangePicker label="Örnek aralık" />
          </Suspense>
        </div>
      </section>

      <section className="rounded-panel-lg border border-dashed border-panel-border-strong bg-panel-surface-muted/50 px-6 py-5">
        <p className="text-sm font-semibold text-panel-fg">Design system</p>
        <p className="mt-2 text-sm text-panel-fg-secondary">
          KPICard tier 1/2/3 + DataTable (başlık tooltip · toplam satırı ·
          zebra/hover) hazır.
        </p>
      </section>
    </div>
  );
}
