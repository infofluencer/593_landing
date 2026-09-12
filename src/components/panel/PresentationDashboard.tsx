import { StatusBadge } from "@/components/panel/StatusBadge";
import { ChannelCard } from "@/components/panel/ChannelCard";
import {
  ConversionPieChart,
  ConvTrendChart,
  MixPieChart,
  SpendTrendChart,
} from "@/components/panel/charts";
import { PanelStat } from "@/components/panel/ui";
import type { PresentationModel } from "@/lib/panel/presentation";
import { formatNumber, formatTry } from "@/lib/panel/format";

export default function PresentationDashboard({
  model,
}: {
  model: PresentationModel;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e91825]">
            Marka sunumu · {model.typeLabel}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
            {model.brand}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Yalnızca bu markanın Meta + Google Ads verileri ·{" "}
            {model.periodLabel}
          </p>
        </div>
        <StatusBadge status={model.health} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PanelStat
          label="Toplam harcama"
          value={formatTry(model.totalSpend, model.currency)}
          hint={
            <span className="text-[11px] text-zinc-500">Meta + Google</span>
          }
        />
        <PanelStat
          label="Toplam dönüşüm"
          value={formatNumber(model.totalConv, 1)}
          hint={
            <span className="text-[11px] text-zinc-500">
              Meta + Google Ads düz toplamı — aynı satış iki kanalda
              görünebilir (üst sınır; dedupe yok)
            </span>
          }
        />
        {model.totalRevenue != null ? (
          <PanelStat
            label="Toplam gelir"
            value={formatTry(model.totalRevenue, model.currency)}
            hint={
              <span className="text-[11px] text-zinc-500">
                Meta + Google Ads dönüşüm değeri düz toplamı — örtüşme
                olabilir (üst sınır; dedupe yok)
              </span>
            }
          />
        ) : (
          <PanelStat
            label="Model"
            value="Lead"
            hint={
              <span className="text-[11px] text-zinc-500">
                Gelir / getiri gösterilmez
              </span>
            }
          />
        )}
        <PanelStat
          label="Kanallar"
          value={`${model.google.status === "unknown" ? "—" : "Google Ads"} · ${model.meta.status === "unknown" ? "—" : "Meta"}`}
          hint={
            <span className="text-[11px] text-zinc-500">
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
        <div className="rounded-xl border border-zinc-200 bg-white p-4 lg:col-span-3">
          <h3 className="text-sm font-semibold text-zinc-800">
            Haftalık harcama (Meta vs Google)
          </h3>
          <div className="mt-3">
            <SpendTrendChart data={model.daily} />
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-zinc-800">
            Bütçe dağılımı
          </h3>
          <MixPieChart data={model.mix} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 lg:col-span-3">
          <h3 className="text-sm font-semibold text-zinc-800">
            Dönüşüm karşılaştırması
          </h3>
          <div className="mt-3">
            <ConvTrendChart data={model.daily} />
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-zinc-800">
            Dönüşüm türleri
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Satış · form · WhatsApp ayrı
          </p>
          <ConversionPieChart data={model.conversionMix} />
        </div>
      </div>
    </div>
  );
}
