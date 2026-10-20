import { headers } from "next/headers";
import { Suspense } from "react";
import BudgetPlanVsActual from "@/components/panel/BudgetPlanVsActual";
import PeriodFilterBar from "@/components/panel/PeriodFilterBar";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { ChartCard } from "@/components/panel/ds";
import { StatTile } from "@/components/panel/ds/viz";
import { SpendTrendChart } from "@/components/panel/charts";
import { loadBrandBudgetPlan } from "@/lib/panel/brand-budget";
import { requireBundle } from "@/lib/panel/data";
import { formatTry } from "@/lib/panel/format";
import { resolvePanelDateRange } from "@/lib/panel/period";
import { bucketSeries } from "@/lib/panel/presentation";
import { loadTenantStatus } from "@/lib/panel/tenant-status";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}) {
  const h = await headers();
  const slug = h.get("x-tenant-slug")!;
  const sp = await searchParams;
  const range = await resolvePanelDateRange(sp);
  const [bundle, budgetPlan] = await Promise.all([
    requireBundle(slug, { from: range.startDate, to: range.endDate }),
    loadBrandBudgetPlan(slug, { from: range.startDate, to: range.endDate }),
  ]);
  const status = await loadTenantStatus(bundle, budgetPlan);
  const { tenant, periodSpend, current, metaCurrent } = bundle;
  const googleSpend = current.account.spend;
  const metaSpend = metaCurrent.account.spend;

  // Harcama varsa göster — Meta/GTM hatası bütçeyi kilitlemez.
  const spent =
    periodSpend > 0 || googleSpend > 0 || metaSpend > 0 ? periodSpend : null;
  const reasons = status.overall.reasons.map((r) => r.text);
  const gSeries = bucketSeries(bundle.googleDaily ?? [], range.startDate, range.endDate);
  const mSeries = bucketSeries(bundle.metaDaily, range.startDate, range.endDate);
  const daily = gSeries.map((g, i) => ({
    label: g.label,
    googleSpend: g.spend,
    metaSpend: mSeries[i]?.spend ?? 0,
    googleConv: g.conv,
    metaConv: mSeries[i]?.conv ?? 0,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Bütçe</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Planlanan bütçe ajans tarafından belirlenir · burada yalnızca izlenir
          </p>
        </div>
        <StatusBadge
          status={spent === null ? "unknown" : status.overall.status}
          reasons={reasons}
        />
      </div>

      <Suspense fallback={null}>
        <PeriodFilterBar label={range.label} />
      </Suspense>

      {spent === null ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
          Harcama verisi alınamadı — durum: <strong>Kontrol edilemedi</strong>{" "}
          (sıfır yazılmadı).
        </div>
      ) : null}

      {budgetPlan ? (
        <BudgetPlanVsActual
          plan={budgetPlan}
          statusReasons={status.budget.reasons.map((r) => r.text)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            label="Harcanan"
            value={spent === null ? null : formatTry(spent, tenant.currency)}
            hint={range.label}
            variant="navy"
          />
          <StatTile
            label="Google Ads"
            value={spent === null ? null : formatTry(googleSpend, tenant.currency)}
            color="#E37400"
            values={gSeries.map((p) => p.spend)}
          />
          <StatTile
            label="Meta Ads"
            value={spent === null ? null : formatTry(metaSpend, tenant.currency)}
            color="#0866FF"
            values={mSeries.map((p) => p.spend)}
          />
        </div>
      )}

      {spent !== null ? (
        <ChartCard
          title="Günlük harcama · Meta ve Google"
          description={range.label}
          empty={daily.length === 0}
        >
          <SpendTrendChart data={daily} />
        </ChartCard>
      ) : null}
    </div>
  );
}
