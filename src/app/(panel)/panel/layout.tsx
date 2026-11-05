import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import AuthSessionProvider from "@/components/panel/AuthSessionProvider";
import SignOutButton from "@/components/panel/SignOutButton";
import PanelShell from "@/components/panel/ds/PanelShell";
import {
  STAFF_NAV_LINKS,
  tenantNavLinks,
} from "@/components/panel/ds/nav-config";
import { prisma } from "@/lib/db";
import { isStaffRole } from "@/lib/panel/host";
import { resolvePanelTenant } from "@/lib/panel/data";
import { loginHref, sanitizeCallbackPath } from "@/lib/panel/auth-nav";

const VIEW_ONLY_PATHS = ["/takvim", "/board"];

/** Marka host: yalnızca o tenant membership — admin bypass yok. */
async function canAccessTenantMembership(
  tenantIds: string[],
  tenantId: string,
  slug: string,
): Promise<boolean> {
  if (tenantIds.includes(tenantId)) return true;
  if (tenantIds.length === 0) return false;
  // Session bazen eski id tutuyorsa slug ile doğrula (tek satır, ucuz).
  const row = await prisma.tenant.findFirst({
    where: { id: { in: tenantIds }, slug },
    select: { id: true },
  });
  return Boolean(row);
}

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const panelMode = h.get("x-panel-mode");
  const slug = h.get("x-tenant-slug");
  const browserPath = sanitizeCallbackPath(h.get("x-panel-pathname"), "/");

  const session = await auth();
  if (!session?.user) {
    redirect(loginHref(browserPath));
  }

  // —— Ajans portalı (admin.*) ——
  if (panelMode === "staff") {
    const viewOnly = session.user.viewOnly;
    if (!isStaffRole(session.user.role) && !viewOnly) {
      return (
        <AuthSessionProvider>
          <main className="panel-root flex min-h-screen items-center justify-center px-4">
            <div className="max-w-md space-y-4 text-center">
              <h1 className="text-lg font-semibold text-panel-fg">Erişim yok</h1>
              <p className="text-sm text-panel-fg-secondary">
                Bu adres yalnızca ajans (admin/team) hesabı içindir. Marka
                paneliniz için kendi subdomain’inizi kullanın.
              </p>
              <SignOutButton />
            </div>
          </main>
        </AuthSessionProvider>
      );
    }

    // Görüntüleyici hesap: yalnızca takvim ve durum panosu.
    if (
      viewOnly &&
      !VIEW_ONLY_PATHS.some(
        (p) => browserPath === p || browserPath.startsWith(`${p}/`),
      )
    ) {
      redirect("/takvim");
    }

    const staffOk =
      browserPath === "/" ||
      browserPath === "/brands" ||
      browserPath.startsWith("/brands/") ||
      browserPath === "/board" ||
      browserPath.startsWith("/board/") ||
      browserPath === "/kampanyalar" ||
      browserPath === "/ekip" ||
      browserPath.startsWith("/ekip/") ||
      browserPath === "/toplantilar" ||
      browserPath.startsWith("/toplantilar/") ||
      browserPath === "/takvim" ||
      browserPath.startsWith("/takvim/") ||
      browserPath === "/audit" ||
      browserPath === "/settings" ||
      browserPath.startsWith("/settings") ||
      browserPath === "/oneriler" ||
      browserPath === "/yedekler" ||
      browserPath === "/bildirimler";
    if (!staffOk) {
      redirect("/brands");
    }
    if (browserPath === "/") {
      redirect("/brands");
    }

    return (
      <AuthSessionProvider>
        <Suspense fallback={null}>
          <PanelShell
            variant="staff"
            nav={
              viewOnly
                ? STAFF_NAV_LINKS.filter((l) => VIEW_ONLY_PATHS.includes(l.href))
                : STAFF_NAV_LINKS
            }
            wide={browserPath === "/takvim"}
            userEmail={session.user.email ?? ""}
            userRoleLabel={viewOnly ? "görüntüleyici" : session.user.role}
          >
            {children}
          </PanelShell>
        </Suspense>
      </AuthSessionProvider>
    );
  }

  // —— Marka subdomain ——
  if (!slug || panelMode !== "tenant") notFound();

  const tenant = await resolvePanelTenant(slug);
  if (!tenant) notFound();

  const allowed = await canAccessTenantMembership(
    session.user.tenantIds,
    tenant.id,
    slug,
  );

  if (!allowed) {
    return (
      <AuthSessionProvider>
        <main className="panel-root flex min-h-screen items-center justify-center px-4">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-lg font-semibold text-panel-fg">Erişim yok</h1>
            <p className="text-sm text-panel-fg-secondary">
              Bu panel yalnızca yetkili olduğunuz markanın hesabıyla açılır.
              <br />
              <span className="mt-2 inline-block text-panel-fg-muted">
                İstenen marka: {tenant.name} ({slug})
              </span>
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                href="/login?error=AccessDenied"
                className="text-sm text-panel-accent hover:underline"
              >
                Giriş sayfası
              </Link>
              <SignOutButton />
            </div>
            <p className="text-xs text-panel-fg-secondary">
              Ajans hesabı için{" "}
              <code className="text-panel-fg-muted">admin.localhost:3006</code>{" "}
              kullanın.
            </p>
          </div>
        </main>
      </AuthSessionProvider>
    );
  }

  const ecommerce = tenant.type === "ecommerce";
  const typeLabel = ecommerce ? "E-TİCARET" : "LEAD";
  const roleLabel =
    session.user.role === "client" ? "müşteri" : session.user.role;

  return (
    <AuthSessionProvider>
      <Suspense fallback={null}>
        <PanelShell
          variant="tenant"
          nav={tenantNavLinks(tenant.disabledIntegrations)}
          brandName={tenant.name}
          brandTypeLabel={typeLabel}
          userEmail={session.user.email ?? ""}
          userRoleLabel={roleLabel}
        >
          {children}
        </PanelShell>
      </Suspense>
    </AuthSessionProvider>
  );
}
