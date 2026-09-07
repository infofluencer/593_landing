import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AddBrandWizard from "@/components/panel/AddBrandWizard";
import { StatusBadge } from "@/components/panel/StatusBadge";
import {
  BulkSyncToolbar,
  TenantSyncActions,
} from "@/components/panel/SyncButton";
import { PanelTable } from "@/components/panel/ui";
import { prisma } from "@/lib/db";
import { getAgencyOverview } from "@/lib/panel/data";
import { formatDateTime, formatNumber, formatTry } from "@/lib/panel/format";
import { resolveAdsCustomerId } from "@/lib/panel/google-ads-customer-map";
import { isStaffRole, rootDomain } from "@/lib/panel/host";
import { useMockPanelData } from "@/lib/integrations/tokens";

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

  const clientByTenantId = new Map<string, number>();
  if (!useMockPanelData() && brands.length) {
    const counts = await prisma.membership.groupBy({
      by: ["tenantId"],
      where: {
        tenantId: { in: brands.map((b) => b.tenant.id) },
        user: { role: "client" },
      },
      _count: { _all: true },
    });
    for (const row of counts) {
      clientByTenantId.set(row.tenantId, row._count._all);
    }
  }

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
        <div className="flex flex-wrap items-center gap-2">
          <AddBrandWizard />
          <BulkSyncToolbar />
        </div>
      </div>

      <ol className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-xs leading-relaxed text-zinc-600">
        <li>
          1. Meta BM’de reklam hesabı açın (veya sihirbazda Meta ID’yi elle
          yazın).
        </li>
        <li>
          2. <span className="font-medium text-zinc-800">Yeni marka</span>{" "}
          sihirbazı ile slug, tip, bütçe ve Google ID’leri kaydedin.
        </li>
        <li>3. İsteğe bağlı müşteri e-posta + şifre (membership) oluşturun.</li>
        <li>4. Satırdan Meta / Google çekin.</li>
        <li>
          5.{" "}
          <code className="text-zinc-500">
            {"{slug}"}.{root}
          </code>{" "}
          ile müşteri girişini doğrulayın.
        </li>
      </ol>

      <PanelTable
        headers={[
          "Marka",
          "Tip",
          "Onboarding",
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
          const adsOk = Boolean(
            resolveAdsCustomerId({
              slug: row.tenant.slug,
              name: row.tenant.name,
              mapping: row.tenant.mapping,
            }),
          );
          const ga4Ok = Boolean(row.tenant.mapping.ga4PropertyId);
          const gtmOk = Boolean(row.tenant.mapping.gtmContainerId);
          const gscOk = Boolean(row.tenant.mapping.gscSiteUrl);
          const clientOk =
            useMockPanelData() ||
            (clientByTenantId.get(row.tenant.id) ?? 0) > 0;
          const missing: string[] = [];
          if (!adsOk) missing.push("Ads");
          if (!ga4Ok) missing.push("GA4");
          if (!gtmOk) missing.push("GTM");
          if (!gscOk) missing.push("GSC");
          if (!clientOk) missing.push("müşteri");
          const settingsHref = `/settings?tenant=${encodeURIComponent(row.tenant.slug)}`;

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
              <td className="px-3 py-3">
                {missing.length === 0 ? (
                  <span className="text-[11px] text-emerald-600">Tamam</span>
                ) : (
                  <div className="flex max-w-[14rem] flex-wrap items-center gap-1">
                    {missing.map((m) => (
                      <span
                        key={m}
                        className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200/80"
                      >
                        {m}
                      </span>
                    ))}
                    <Link
                      href={settingsHref}
                      className="text-[10px] font-medium text-[#e91825] hover:underline"
                    >
                      Eksikleri tamamla
                    </Link>
                  </div>
                )}
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
                  href={settingsHref}
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
