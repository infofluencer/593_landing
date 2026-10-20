/**
 * Firma sayfaları için durum seti — bundle + bütçe planından
 * computeTenantStatus girdisini hazırlar (sunucu).
 */
import { getIstanbulTodayYmd } from "@/lib/date/now";
import {
  summarizeBudgetPlan,
  type BrandBudgetPlan,
} from "@/lib/panel/brand-budget";
import type { MockTenantBundle } from "@/lib/panel/mock-data";
import {
  computeTenantStatus,
  type StatusPlanInput,
  type TenantStatus,
} from "@/lib/panel/status-reasons";

export function planInputFromBudget(
  plan: BrandBudgetPlan | null | undefined,
): StatusPlanInput | null {
  if (!plan) return null;
  const brandBase = plan.canEdit ? plan.brand : plan.rangeBrand;
  const summary = summarizeBudgetPlan(brandBase, plan.campaigns);
  const todayRow = plan.pace.daily.find((d) => d.date === plan.today);
  return {
    planned: summary.plannedMonthly,
    google: summary.google.plannedMonthly > 0 ? summary.google.plannedMonthly : null,
    meta: summary.meta.plannedMonthly > 0 ? summary.meta.plannedMonthly : null,
    spent: plan.pace.daily.reduce((s, d) => s + d.google + d.meta, 0),
    todaySpend: todayRow ? todayRow.google + todayRow.meta : 0,
    from: plan.pace.from,
    to: plan.pace.to,
  };
}

export async function loadTenantStatus(
  bundle: MockTenantBundle,
  plan: BrandBudgetPlan | null | undefined,
): Promise<TenantStatus> {
  const today = await getIstanbulTodayYmd();
  return computeTenantStatus(bundle, { today, plan: planInputFromBudget(plan) });
}
