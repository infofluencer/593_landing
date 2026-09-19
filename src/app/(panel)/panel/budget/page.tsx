import { headers } from "next/headers";
import { Suspense } from "react";
import PeriodFilterBar from "@/components/panel/PeriodFilterBar";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { KPICard } from "@/components/panel/ds";
import { PanelTable } from "@/components/panel/ui";
import { requireBundle } from "@/lib/panel/data";
import { formatDate, formatTry } from "@/lib/panel/format";
import { resolvePanelDateRange } from "@/lib/panel/period";

export default async function BudgetPage({
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
  const { tenant, periodSpend, health, current, metaCurrent, dailySpend } =
    bundle;
  const googleSpend = current.account.spend;
  const metaSpend = metaCurrent.account.spend;

  // Harcama varsa göster — Meta/GTM hatası bütçeyi kilitlemez.
  const spent =
    periodSpend > 0 || googleSpend > 0 || metaSpend > 0 ? periodSpend : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Bütçe ve yayın temposu
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Gerçekleşen harcama · kanal kırılımı
          </p>
        </div>
        <StatusBadge status={spent === null ? "unknown" : health} />
      </div>

      <Suspense fallback={null}>
        <PeriodFilterBar label={range.label} />
      </Suspense>

      {spent === null ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          Harcama verisi alınamadı — durum:{" "}
          <strong>Kontrol edilemedi</strong> (sıfır yazılmadı).
        </div>
      ) : null}

      {/* Tier 1 — dönem özeti */}
      <div className="max-w-md">
        <KPICard
          tier={1}
          metricKey="spend"
          kind="money"
          label="Gerçekleşen"
          accent="var(--panel-accent)"
          value={
            spent === null ? null : formatTry(spent, tenant.currency)
          }
          hint={
            spent !== null ? (
              <span className="text-[11px] text-panel-fg-secondary">
                {range.label}
              </span>
            ) : null
          }
          goodDirection="neutral"
        />
      </div>

      {spent !== null ? (
        <>
          {/* Tier 2 — kanal kırılımı */}
          <div className="grid gap-3 sm:grid-cols-2">
            <KPICard
              tier={2}
              metricKey="spend"
              kind="money"
              label="Google Ads"
              accent="var(--panel-google-blue)"
              value={formatTry(googleSpend, tenant.currency)}
              goodDirection="neutral"
            />
            <KPICard
              tier={2}
              metricKey="spend"
              kind="money"
              label="Meta Ads"
              accent="var(--panel-meta)"
              value={formatTry(metaSpend, tenant.currency)}
              goodDirection="neutral"
            />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-900">
                Günlük harcama
              </h3>
              <p className="text-xs text-zinc-500">{range.label}</p>
            </div>
            {dailySpend.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
                Bu dönem için günlük harcama satırı yok.
              </div>
            ) : (
              <PanelTable
                headers={["Tarih", "Google Ads", "Meta Ads", "Toplam"]}
                numericCols={[1, 2, 3]}
              >
                {dailySpend.map((row) => (
                  <tr key={row.date}>
                    <td className="font-medium text-panel-fg whitespace-nowrap">
                      {formatDate(row.date)}
                    </td>
                    <td className="num">
                      {formatTry(row.google, tenant.currency)}
                    </td>
                    <td className="num">
                      {formatTry(row.meta, tenant.currency)}
                    </td>
                    <td className="num font-medium">
                      {formatTry(row.total, tenant.currency)}
                    </td>
                  </tr>
                ))}
              </PanelTable>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
