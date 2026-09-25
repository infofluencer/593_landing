import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AddBrandWizard from "@/components/panel/AddBrandWizard";
import AgencyBrandGrid, {
  AgencyBrandArrangeProvider,
  AgencyBrandEditButton,
} from "@/components/panel/AgencyBrandGrid";
import { BulkSyncToolbar } from "@/components/panel/SyncButton";
import { countAgencyBrands, listAgencyBrands } from "@/lib/panel/data";
import { isStaffRole, rootDomain } from "@/lib/panel/host";

/**
 * Sadece admin/team — ajans portalında (admin.*) tüm markalar.
 * Marka subdomain’lerinde müşteri kendi paneline girer; admin orada oturum açamaz.
 */
export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
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
  const access = {
    role: session.user.role,
    tenantIds: session.user.tenantIds,
    hostSlug: "admin",
  };

  const [brands, counts] = await Promise.all([
    listAgencyBrands({
      ...access,
      visible: !showInactive,
    }),
    countAgencyBrands(access),
  ]);

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
          <AddBrandWizard />
          <BulkSyncToolbar />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Link
            href="/brands/sync"
            className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
          >
            Veri çekimi
          </Link>
          <Link
            href="/brands"
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              !showInactive
                ? "border-[#e91825]/40 bg-[#e91825]/10 text-[#e91825]"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
            }`}
          >
            Aktif ({counts.active})
          </Link>
          <Link
            href="/brands?status=inactive"
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              showInactive
                ? "border-[#e91825]/40 bg-[#e91825]/10 text-[#e91825]"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
            }`}
          >
            Devre dışı ({counts.inactive})
          </Link>
        </div>
        <AgencyBrandEditButton />
      </div>

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

      {brands.length === 0 ? (
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
