import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StatusBadge } from "@/components/panel/StatusBadge";
import {
  BulkSyncToolbar,
  TenantSyncActions,
} from "@/components/panel/SyncButton";
import { PanelTable } from "@/components/panel/ui";
import { getAgencyOverview } from "@/lib/panel/data";
import { formatDateTime, formatNumber, formatTry } from "@/lib/panel/format";
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

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const isLocal = host.includes("localhost") || host.startsWith("127.");
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
            Meta ve Google ayrı çekilir — üstten toplu, satırdan firma özel.
            Marka panelleri yalnızca o markanın hesabıyla açılır (
            <code className="text-zinc-400">marka.{root}</code>
            ).
          </p>
        </div>
        <BulkSyncToolbar />
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
          "Veri çek",
          "",
        ]}
      >
        {brands.map((row) => {
          const isUnknown = row.health === "unknown";
          const panelHost = isLocal
            ? `${row.tenant.slug}.localhost:3006`
            : `${row.tenant.slug}.${root}`;
          const panelProto = isLocal ? "http" : "https";
          return (
            <tr key={row.tenant.slug} className="text-zinc-700">
              <td className="px-3 py-3">
                <span className="font-medium text-zinc-900">
                  {row.tenant.name}
                </span>
              </td>
              <td className="px-3 py-3 text-xs text-zinc-400">
                {row.tenant.type === "ecommerce" ? "E-ticaret" : "Lead"}
              </td>
              <td className="px-3 py-3 font-mono text-xs text-zinc-500">
                <a
                  href={`${panelProto}://${panelHost}/`}
                  className="hover:text-zinc-800 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {panelHost}
                </a>
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
              <td className="px-3 py-3">
                <TenantSyncActions tenantSlug={row.tenant.slug} />
              </td>
              <td className="px-3 py-3 text-right">
                <Link
                  href={`/settings?tenant=${encodeURIComponent(row.tenant.slug)}`}
                  className="text-xs font-medium text-[#e91825] hover:underline"
                >
                  Ayarlar
                </Link>
              </td>
            </tr>
          );
        })}
      </PanelTable>
    </div>
  );
}
