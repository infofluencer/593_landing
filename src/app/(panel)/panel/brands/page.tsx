import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AddBrandWizard from "@/components/panel/AddBrandWizard";
import AgencyBrandTable from "@/components/panel/AgencyBrandTable";
import AgencyBrandGrid, {
  AgencyBrandArrangeProvider,
  AgencyBrandEditButton,
} from "@/components/panel/AgencyBrandGrid";
import { BulkSyncToolbar } from "@/components/panel/SyncButton";
import { btnSecondary, chipClass } from "@/components/panel/ds/buttons";
import { listStaffOptions } from "@/lib/panel/audit-query";
import { formatBudgetMonthLabel } from "@/lib/panel/brand-budget";
import { loadAgencyResults } from "@/lib/panel/agency-results";
import { loadBrandTable } from "@/lib/panel/brand-table";
import { getHourlySyncState } from "@/lib/panel/hourly-sync";
import { countAgencyBrands, listAgencyBrands } from "@/lib/panel/data";
import { isStaffRole, rootDomain } from "@/lib/panel/host";
import { can } from "@/lib/panel/permissions";

/**
 * Sadece admin/team — ajans portalında (admin.*) tüm markalar.
 * Marka subdomain’lerinde müşteri kendi paneline girer; admin orada oturum açamaz.
 */
export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffRole(session.user.role)) {
    redirect("/");
  }

  const h = await headers();
  const panelMode = h.get("x-panel-mode");
  if (panelMode !== "staff") {
    redirect("/login?error=AccessDenied");
  }

  const root = rootDomain();
  const sp = await searchParams;
  const showInactive = sp.status === "inactive";
  const tableView = sp.view === "table";
  const access = {
    role: session.user.role,
    tenantIds: session.user.tenantIds,
    hostSlug: "admin",
  };

  const [brands, counts, table, staff, hourlySync] = await Promise.all([
    tableView
      ? Promise.resolve([])
      : listAgencyBrands({
          ...access,
          visible: !showInactive,
        }),
    countAgencyBrands(access),
    tableView ? loadBrandTable({ ...access, visible: !showInactive }) : null,
    tableView ? listStaffOptions() : Promise.resolve([]),
    tableView
      ? getHourlySyncState()
      : Promise.resolve({ running: false, lastSuccessAt: null, lastError: null }),
  ]);

  const results = table
    ? await loadAgencyResults({
        tenants: table.rows,
        today: table.today,
        month: table.month,
      })
    : null;

  /** Durum + görünüm parametrelerini koruyarak link üretir. */
  const brandsHref = (next: { inactive?: boolean; table?: boolean }) => {
    const q = new URLSearchParams();
    if (next.inactive ?? showInactive) q.set("status", "inactive");
    if (next.table ?? tableView) q.set("view", "table");
    const qs = q.toString();
    return qs ? `/brands?${qs}` : "/brands";
  };
  const toggleClass = chipClass;

  return (
    <AgencyBrandArrangeProvider enabled={brands.length > 0}>
      <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Ajans — marka listesi
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Kareye tıklayarak detay, senkron ve ayarlara gidin. Panel:{" "}
            <code className="text-zinc-400">slug.{root}</code>
          </p>
        </div>
        <div className="flex flex-wrap items-end justify-end gap-2.5 sm:gap-3">
          {can(session.user.role, "brands.create") ? (
            <AddBrandWizard rootDomain={root} />
          ) : null}
          <BulkSyncToolbar />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Link href="/brands/sync" className={btnSecondary}>
            Veri çekimi
          </Link>
          <Link
            href={brandsHref({ inactive: false })}
            className={toggleClass(!showInactive)}
          >
            Aktif ({counts.active})
          </Link>
          <Link
            href={brandsHref({ inactive: true })}
            className={toggleClass(showInactive)}
          >
            Devre dışı ({counts.inactive})
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div
            className="flex gap-2"
            role="group"
            aria-label="Görünüm"
          >
            <Link
              href={brandsHref({ table: false })}
              aria-current={!tableView ? "page" : undefined}
              className={toggleClass(!tableView)}
            >
              Kart
            </Link>
            <Link
              href={brandsHref({ table: true })}
              aria-current={tableView ? "page" : undefined}
              className={toggleClass(tableView)}
            >
              Tablo
            </Link>
          </div>
          {tableView ? null : <AgencyBrandEditButton />}
        </div>
      </div>

      {table && results ? (
        <AgencyBrandTable
          rows={table.rows}
          monthLabel={formatBudgetMonthLabel(table.month)}
          today={table.today}
          daysInMonth={table.daysInMonth}
          currentHour={table.currentHour}
          hourlySync={hourlySync}
          results={results}
          staff={staff}
        />
      ) : null}

      {tableView ? null : (
      <ol className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-xs leading-relaxed text-zinc-600">
        <li>
          1. Meta’da hesap BM’de olsun · system user’a varlık ata (
          <code className="text-zinc-500">act_…</code>).
        </li>
        <li>
          2. <span className="font-medium text-zinc-800">Yeni marka</span> —
          slug + Meta act_ (map önerir) + Google ID’ler.
        </li>
        <li>3. İsteğe bağlı müşteri e-posta / şifre.</li>
        <li>
          4. Marka detayından{" "}
          <span className="font-medium text-zinc-800">Meta</span> sonra{" "}
          <span className="font-medium text-zinc-800">Google</span> çek.
        </li>
        <li>
          5. Bütçe planı — marka aylık / kampanya günlük-aylık (wizard veya
          marka detayı).
        </li>
        <li>
          6.{" "}
          <code className="text-zinc-500">
            {"{slug}"}.{root}
          </code>{" "}
          ile müşteri girişini doğrula · eksikler için Ayarlar.
        </li>
      </ol>
      )}

      {tableView ? null : brands.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">
          {showInactive
            ? "Devre dışı marka yok."
            : "Henüz aktif marka yok. Yeni marka ekleyin."}
        </p>
      ) : (
        <AgencyBrandGrid
          key={`${showInactive ? "inactive" : "active"}:${[...brands]
            .map((row) => row.slug)
            .sort()
            .join(",")}`}
          brands={brands}
          inactive={showInactive}
        />
      )}
      </div>
    </AgencyBrandArrangeProvider>
  );
}
