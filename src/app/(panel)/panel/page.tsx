import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import PeriodFilterBar from "@/components/panel/PeriodFilterBar";
import PresentationDashboard from "@/components/panel/PresentationDashboard";
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900">
          Bu ekran <strong className="font-semibold">{model.brand}</strong>{" "}
          markasına özeldir. Başka firmanın verisi burada görünmez.
        </div>
      </div>

      <Suspense fallback={null}>
        <PeriodFilterBar label={range.label} />
      </Suspense>

      <PresentationDashboard model={model} />
    </div>
  );
}
