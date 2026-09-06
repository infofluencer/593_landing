import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import PresentationDashboard from "@/components/panel/PresentationDashboard";
import SyncButton from "@/components/panel/SyncButton";
import { requireBundle } from "@/lib/panel/data";
import { buildPresentation } from "@/lib/panel/presentation";

/**
 * Marka paneli ana sayfa — yalnızca host subdomain markasının verisi.
 * Diğer markalar burada listelenmez (ajans listesi: /brands, sadece admin/team).
 */
export default async function PanelHomePage() {
  const h = await headers();
  const hostSlug = h.get("x-tenant-slug");
  if (!hostSlug) redirect("/login");

  const session = await auth();
  if (!session?.user) redirect("/login");

  const bundle = await requireBundle(hostSlug);
  const model = buildPresentation(bundle);

  const isStaff =
    session.user.role === "admin" || session.user.role === "team";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900">
          Bu ekran <strong className="font-semibold">{model.brand}</strong>{" "}
          markasına özeldir. Başka firmanın verisi burada görünmez.
        </div>
        {isStaff ? <SyncButton tenantSlug={hostSlug} /> : null}
      </div>

      <PresentationDashboard model={model} />
    </div>
  );
}
