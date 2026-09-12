import Link from "next/link";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { Delta } from "@/components/panel/ui";
import type { ChannelView } from "@/lib/panel/presentation";
import { METRIC_HELP } from "@/lib/panel/presentation";
import { formatNumber, formatTry } from "@/lib/panel/format";

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

  return (
    <section
      className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5"
      style={{ boxShadow: `inset 3px 0 0 ${channel.color}` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: channel.color }}
          >
            {channel.label}
          </p>
          <h3 className="mt-1 text-base font-semibold text-zinc-900">
            {channel.sectionTitle}
          </h3>
        </div>
        <StatusBadge status={channel.status} />
      </div>

      {channel.statusNote ? (
        <p className="mt-3 rounded-md bg-zinc-100 px-3 py-2 text-xs leading-5 text-zinc-600">
          {channel.statusNote}
        </p>
      ) : null}

      {unknown ? (
        <p className="mt-6 text-sm text-zinc-500">
          Bağlantı veya sync sorunu — rakamlar kasıtlı olarak boş (0
          uydurulmadı). Durum: Kontrol edilemedi.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Kpi
            label="Harcama"
            help={METRIC_HELP.spend}
            value={formatTry(channel.spend, currency)}
            delta={channel.spendDelta}
            invert
          />
          <Kpi
            label="Tıklama"
            help={METRIC_HELP.clicks}
            value={formatNumber(channel.clicks)}
          />
          <Kpi
            label="Dönüşüm"
            help={METRIC_HELP.conv}
            value={formatNumber(channel.conv, 1)}
            delta={channel.convDelta}
          />
          {channel.showRevenue && channel.convValue != null ? (
            <Kpi
              label="Gelir"
              help="Dönüşüm değeri"
              value={formatTry(channel.convValue, currency)}
            />
          ) : null}
          {channel.showRoas && channel.roas != null ? (
            <Kpi
              label="Getiri"
              help={METRIC_HELP.roas}
              value={`${formatNumber(channel.roas, 2)}x`}
            />
          ) : null}
          <Kpi
            label={channel.costPerResultLabel}
            help={
              channel.costPerResultLabel.includes("Lead")
                ? METRIC_HELP.cpl
                : METRIC_HELP.cpa
            }
            value={
              channel.costPerResult != null
                ? formatTry(channel.costPerResult, currency)
                : "—"
            }
          />
          <Kpi
            label="Tıklama oranı"
            help={METRIC_HELP.ctr}
            value={`${formatNumber(channel.ctr, 2)}%`}
          />
          <Kpi
            label="Gösterim"
            help={METRIC_HELP.impr}
            value={formatNumber(channel.impr)}
          />
          {channel.reach != null ? (
            <Kpi
              label="Erişim"
              help={METRIC_HELP.reach}
              value={formatNumber(channel.reach)}
            />
          ) : null}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        {href && href !== "#" ? (
          <Link
            href={href}
            className="text-xs font-medium text-zinc-500 transition hover:text-zinc-900"
          >
            {channel.short} detay →
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function Kpi({
  label,
  help,
  value,
  delta,
  invert,
}: {
  label: string;
  help: string;
  value: string;
  delta?: number | null;
  invert?: boolean;
}) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
        {value}
      </p>
      {delta != null ? (
        <div className="mt-0.5">
          <Delta value={delta} invert={invert} />
          <span className="ml-1 text-[10px] text-zinc-600">önceki aya</span>
        </div>
      ) : (
        <p className="mt-1 text-[10px] leading-4 text-zinc-600">{help}</p>
      )}
    </div>
  );
}
