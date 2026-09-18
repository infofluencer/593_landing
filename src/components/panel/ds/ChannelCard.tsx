import Link from "next/link";
import type { ChannelView } from "@/lib/panel/presentation";
import { formatNumber, formatTry } from "@/lib/panel/format";
import { GoogleAdsMark, MetaMark } from "./BrandMarks";
import { EmptyState } from "./EmptyState";
import { MetricCell } from "./MetricCell";
import { StatusBadge } from "./StatusBadge";

/**
 * Meta / Google provider kartı — logo + durum + metrik ızgarası + detay linki.
 * Metrik tipleri metric-kinds kalıbına bağlı.
 */
export function ChannelCard({
  channel,
  currency,
  href,
}: {
  channel: ChannelView;
  currency: string;
  href?: string;
}) {
  const unknown = channel.status === "unknown";
  const isMeta = channel.id === "meta";
  const accent = isMeta ? "var(--panel-meta)" : "var(--panel-google-blue)";

  return (
    <section
      className="rounded-panel-lg border border-panel-border bg-panel-surface shadow-panel"
      style={{ boxShadow: `inset 3px 0 0 ${accent}, var(--panel-shadow)` }}
    >
      <header className="flex flex-wrap items-start gap-3 border-b border-panel-border px-5 py-4 sm:px-6">
        <div className="mr-auto flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-panel-md bg-panel-surface-muted">
            {isMeta ? (
              <MetaMark className="size-5" />
            ) : (
              <GoogleAdsMark className="size-5" />
            )}
          </span>
          <div className="min-w-0">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: accent }}
            >
              {channel.label}
            </p>
            <h3 className="mt-0.5 text-base font-semibold tracking-tight text-panel-fg">
              {channel.sectionTitle}
            </h3>
          </div>
        </div>
        <StatusBadge status={channel.status} />
      </header>

      <div className="px-5 py-5 sm:px-6">
        {channel.statusNote ? (
          <p className="mb-4 rounded-panel-md bg-panel-surface-muted px-3 py-2 text-xs leading-5 text-panel-fg-secondary">
            {channel.statusNote}
          </p>
        ) : null}

        {unknown ? (
          <EmptyState
            variant="unknown"
            title="Kontrol edilemedi"
            description="Bağlantı veya sync sorunu — rakamlar kasıtlı olarak boş (0 uydurulmadı)."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <MetricCell
              kind="money"
              label="Harcama"
              metricKey="spend"
              value={formatTry(channel.spend, currency)}
              delta={channel.spendDelta}
              goodDirection="down"
            />
            <MetricCell
              kind="count"
              label="Tıklama"
              metricKey="clicks"
              value={formatNumber(channel.clicks)}
            />
            <MetricCell
              kind="count"
              label="Dönüşüm"
              metricKey="conversions"
              value={formatNumber(channel.conv, 1)}
              delta={channel.convDelta}
              goodDirection="up"
            />
            {channel.showRevenue && channel.convValue != null ? (
              <MetricCell
                kind="money"
                label="Gelir"
                metricKey="revenue"
                value={formatTry(channel.convValue, currency)}
                goodDirection="up"
              />
            ) : null}
            {channel.showRoas && channel.roas != null ? (
              <MetricCell
                kind="multiplier"
                label="Getiri"
                metricKey="roas"
                value={`${formatNumber(channel.roas, 2)}x`}
                goodDirection="up"
              />
            ) : null}
            <MetricCell
              kind="money"
              label={channel.costPerResultLabel}
              metricKey={
                channel.costPerResultLabel.includes("Lead") ? "cpl" : "cpa"
              }
              value={
                channel.costPerResult != null
                  ? formatTry(channel.costPerResult, currency)
                  : null
              }
              goodDirection="down"
            />
            <MetricCell
              kind="rate"
              label="Tıklama oranı"
              metricKey="ctr"
              value={`${formatNumber(channel.ctr, 2)}%`}
              goodDirection="up"
            />
            <MetricCell
              kind="count"
              label="Gösterim"
              metricKey="impressions"
              value={formatNumber(channel.impr)}
              goodDirection="neutral"
            />
            {channel.reach != null ? (
              <MetricCell
                kind="count"
                label="Erişim"
                metricKey="reach"
                value={formatNumber(channel.reach)}
                goodDirection="up"
              />
            ) : null}
          </div>
        )}

        {href && href !== "#" ? (
          <div className="mt-5 flex justify-end">
            <Link
              href={href}
              className="text-xs font-medium text-panel-fg-secondary transition hover:text-panel-fg"
            >
              {channel.short} detay →
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
