import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AddBrandWizard from "@/components/panel/AddBrandWizard";
import { StatusBadge } from "@/components/panel/StatusBadge";
import { BulkSyncToolbar } from "@/components/panel/SyncButton";
import { getAgencyOverview } from "@/lib/panel/data";
import {
  brandInitials,
  resolveBrandLogo,
} from "@/lib/panel/brand-logos";
import { isStaffRole, rootDomain } from "@/lib/panel/host";

/**
 * Sadece admin/team — ajans portalında (admin.*) tüm markalar.
 * Marka subdomain’lerinde müşteri kendi paneline girer; admin orada oturum açamaz.
 */
export default async function BrandsPage() {
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

  const brands = await getAgencyOverview({
    role: session.user.role,
    tenantIds: session.user.tenantIds,
    hostSlug: "admin",
  });

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
          5.{" "}
          <code className="text-zinc-500">
            {"{slug}"}.{root}
          </code>{" "}
          ile müşteri girişini doğrula · eksikler için Ayarlar.
        </li>
      </ol>

      {brands.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">
          Henüz görünür marka yok. Yeni marka ekleyin.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {brands.map((row) => {
            const logo = resolveBrandLogo(row.tenant.slug, row.tenant.name);
            const href = `/brands/${encodeURIComponent(row.tenant.slug)}`;

            return (
              <li key={row.tenant.slug}>
                <Link
                  href={href}
                  className="group flex flex-col overflow-hidden rounded-[1.15rem] border border-zinc-200/90 bg-white transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-[#e91825]/35 hover:shadow-[0_18px_36px_-24px_rgba(0,0,0,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e91825]"
                >
                  <div className="aspect-square w-full p-2 sm:p-2.5">
                    <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[0.85rem] bg-[#f4f1ea] transition duration-300 group-hover:bg-[#f7f4ed]">
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logo}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-contain p-2.5 transition duration-300 group-hover:scale-[1.03] sm:p-3"
                        />
                      ) : (
                        <span className="select-none text-2xl font-semibold tracking-tight text-zinc-400 sm:text-3xl">
                          {brandInitials(row.tenant.name)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1.5 px-2 pb-3 pt-0.5 text-center sm:px-3 sm:pb-3.5">
                    <p className="line-clamp-2 text-[11px] font-medium leading-snug tracking-tight text-zinc-800 sm:text-xs">
                      {row.tenant.name}
                    </p>
                    <StatusBadge status={row.health} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
