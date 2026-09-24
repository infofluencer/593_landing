import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import BudgetPlanVsActual from "@/components/panel/BudgetPlanVsActual";
import PresentationDashboard from "@/components/panel/PresentationDashboard";
import { DateRangePicker } from "@/components/panel/ds";
import { loadBrandBudgetPlan } from "@/lib/panel/brand-budget";
import { requireBundle } from "@/lib/panel/data";
import { resolvePanelDateRange } from "@/lib/panel/period";
import { buildPresentation } from "@/lib/panel/presentation";

/**
 * Marka paneli ana sayfa — yalnızca host subdomain markasının üyesi.
 * Sync / ajans: admin.* portalı.
 */
export default async function PanelHomePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}) {
  const h = await headers();
  const hostSlug = h.get("x-tenant-slug");
  if (!hostSlug) redirect("/login");

  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const range = await resolvePanelDateRange(sp);
  const bundle = await requireBundle(hostSlug, {
    from: range.startDate,
    to: range.endDate,
  });
  const model = buildPresentation(bundle, range.label);
  const budgetPlan = await loadBrandBudgetPlan(hostSlug, {
    from: range.startDate,
    to: range.endDate,
  });

  return (
    <div className="space-y-6">
      <div className="rounded-panel-md border border-panel-ok/25 bg-panel-ok-bg px-3 py-2 text-xs leading-5 text-panel-ok">
        Bu ekran <strong className="font-semibold">{model.brand}</strong>{" "}
        markasına özeldir. Başka firmanın verisi burada görünmez.
      </div>

      <Suspense fallback={null}>
        <DateRangePicker label={range.label} showCompare={false} />
      </Suspense>

      {budgetPlan ? (
        <BudgetPlanVsActual plan={budgetPlan} variant="compact" />
      ) : null}

      <PresentationDashboard model={model} />
    </div>
  );
}
