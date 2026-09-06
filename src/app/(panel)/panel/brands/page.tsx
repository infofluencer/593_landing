import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StatusBadge } from "@/components/panel/StatusBadge";
import SyncButton from "@/components/panel/SyncButton";
import { PanelTable } from "@/components/panel/ui";
import { getAgencyOverview } from "@/lib/panel/data";
import { formatDateTime, formatNumber, formatTry } from "@/lib/panel/format";

/**
 * Sadece admin/team — tüm markalara geçiş listesi.
 * Müşteri (client) bu sayfaya giremez; her marka kendi subdomain'inde kalır.
 */
export default async function BrandsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "team") {
    redirect("/");
  }

  const h = await headers();
  const hostSlug = h.get("x-tenant-slug") ?? "demo";

  const brands = await getAgencyOverview({
    role: session.user.role,
    tenantIds: session.user.tenantIds,
    hostSlug,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Ajans — marka listesi
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Her markanın paneli kendi adresinde açılır (
            <code className="text-zinc-400">marka.593emarketing.com</code>
            ). Müşteri yalnızca kendi markasını görür.
          </p>
        </div>
        <SyncButton />
      </div>

      <PanelTable
        headers={[
          "Marka",
          "Tip",
          "Panel adresi",
          "Durum",
          "Harcama",
          "Dönüşüm",
          "Son kontrol",
        ]}
      >
        {brands.map((row) => {
          const isUnknown = row.health === "unknown";
          const panelHost = `${row.tenant.slug}.localhost:3006`;
          return (
            <tr key={row.tenant.slug} className="text-zinc-700">
              <td className="px-3 py-3">
                <Link
                  href={`http://${panelHost}/`}
                  className="font-medium text-zinc-900 hover:text-zinc-900"
                >
                  {row.tenant.name}
                </Link>
              </td>
              <td className="px-3 py-3 text-xs text-zinc-400">
                {row.tenant.type === "ecommerce" ? "E-ticaret" : "Lead"}
              </td>
              <td className="px-3 py-3 font-mono text-xs text-zinc-500">
                {row.tenant.slug}.…
              </td>
              <td className="px-3 py-3">
                <StatusBadge status={row.health} />
              </td>
              <td className="px-3 py-3 tabular-nums">
                {isUnknown
                  ? "—"
                  : formatTry(row.periodSpend, row.tenant.currency)}
              </td>
              <td className="px-3 py-3 tabular-nums">
                {isUnknown ? "—" : formatNumber(row.periodConv)}
              </td>
              <td className="px-3 py-3 text-xs text-zinc-500">
                {formatDateTime(row.lastCheckAt)}
              </td>
            </tr>
          );
        })}
      </PanelTable>
    </div>
  );
}
