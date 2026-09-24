import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AddBrandWizard from "@/components/panel/AddBrandWizard";
import BrandCoverUpload from "@/components/panel/BrandCoverUpload";
import BrandVisibilityToggle from "@/components/panel/BrandVisibilityToggle";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { BulkSyncToolbar } from "@/components/panel/SyncButton";
import { countAgencyBrands, listAgencyBrands } from "@/lib/panel/data";
import {
  brandInitials,
  resolveBrandCover,
} from "@/lib/panel/brand-logos";
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

      <div className="flex flex-wrap gap-1.5">
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
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {brands.map((row) => {
            const cover = resolveBrandCover({
              slug: row.slug,
              name: row.name,
              coverUrl: row.coverUrl,
            });
            const href = `/brands/${encodeURIComponent(row.slug)}`;

            return (
              <li key={row.slug}>
                <div
                  className={`flex flex-col overflow-hidden rounded-[1.15rem] border bg-white ${
                    showInactive
                      ? "border-zinc-200/80"
                      : "border-zinc-200/90"
                  }`}
                >
                  <Link
                    href={href}
                    className="group flex flex-col transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e91825]"
                  >
                    <div className="aspect-square w-full p-2 sm:p-2.5">
                      <div
                        className={`flex h-full w-full items-center justify-center overflow-hidden rounded-[0.85rem] bg-[#f4f1ea] transition duration-300 group-hover:bg-[#f7f4ed] ${
                          showInactive ? "opacity-60 grayscale" : ""
                        }`}
                      >
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cover.src}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className={
                              cover.fit === "cover"
                                ? "h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                                : "h-full w-full object-contain p-2.5 transition duration-300 group-hover:scale-[1.03] sm:p-3"
                            }
                          />
                        ) : (
                          <span className="select-none text-2xl font-semibold tracking-tight text-zinc-400 sm:text-3xl">
                            {brandInitials(row.name)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-1.5 px-2 pb-2 pt-0.5 text-center sm:px-3">
                      <p className="line-clamp-2 text-[11px] font-medium leading-snug tracking-tight text-zinc-800 sm:text-xs">
                        {row.name}
                      </p>
                      {showInactive || !row.health ? (
                        <span className="rounded-md border border-zinc-200 bg-zinc-100 px-2 py-1 text-[10px] font-semibold tracking-wide text-zinc-600">
                          Devre dışı
                        </span>
                      ) : (
                        <StatusBadge status={row.health} />
                      )}
                    </div>
                  </Link>
                  <div className="flex flex-col items-center gap-1.5 px-2 pb-3 pt-0.5 sm:px-3 sm:pb-3.5">
                    <BrandVisibilityToggle
                      tenantSlug={row.slug}
                      visible={row.visible}
                    />
                    <BrandCoverUpload
                      tenantSlug={row.slug}
                      brandName={row.name}
                      coverUrl={row.coverUrl}
                      variant="card"
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
