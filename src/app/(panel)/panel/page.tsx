import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import BudgetPlanVsActual from "@/components/panel/BudgetPlanVsActual";
import PresentationDashboard from "@/components/panel/PresentationDashboard";
import { DateRangePicker } from "@/components/panel/ds";
import { loadBrandBudgetPlan } from "@/lib/panel/brand-budget";
import { requireBundle } from "@/lib/panel/data";
import { withMetaPeriodReach } from "@/lib/panel/meta-reach";
import { resolvePanelDateRange } from "@/lib/panel/period";
import { buildPresentation } from "@/lib/panel/presentation";
import { loadTenantStatus } from "@/lib/panel/tenant-status";

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
  const [bundle, budgetPlan] = await Promise.all([
    withMetaPeriodReach(
      await requireBundle(hostSlug, {
        from: range.startDate,
        to: range.endDate,
      }),
      { from: range.startDate, to: range.endDate },
    ),
    loadBrandBudgetPlan(hostSlug, {
      from: range.startDate,
      to: range.endDate,
    }),
  ]);
  const status = await loadTenantStatus(bundle, budgetPlan);
  const model = buildPresentation(bundle, range.label, status);

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <DateRangePicker label={range.label} showCompare={false} />
      </Suspense>

      <PresentationDashboard
        model={model}
        budget={
          budgetPlan ? (
            <BudgetPlanVsActual
              plan={budgetPlan}
              variant="compact"
              statusReasons={status.budget.reasons.map((r) => r.text)}
            />
          ) : undefined
        }
      />
    </div>
  );
}
