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
  TENANT_NAV_LINKS,
} from "@/components/panel/ds/nav-config";
import { prisma } from "@/lib/db";
import { isStaffRole } from "@/lib/panel/host";
import { resolvePanelTenant } from "@/lib/panel/data";
import { loginHref, sanitizeCallbackPath } from "@/lib/panel/auth-nav";

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

function staffPageTitle(browserPath: string): string {
  if (browserPath === "/board" || browserPath.startsWith("/board/")) {
    return "Durum tablosu";
  }
  if (browserPath === "/ekip" || browserPath.startsWith("/ekip/")) {
    return "Ekip";
  }
  if (browserPath === "/settings" || browserPath.startsWith("/settings")) {
    return "Ayarlar";
  }
  if (browserPath === "/design" || browserPath.startsWith("/design/")) {
    return "Tasarım sistemi";
  }
  if (browserPath.startsWith("/brands/")) {
    return "Marka detayı";
  }
  return "Markalar";
}

function tenantPageTitle(browserPath: string, brandName: string): string {
  const map: Record<string, string> = {
    "/": "Sunum",
    "/meta": "Meta",
    "/google": "Google Ads",
    "/ga4": "GA4",
    "/gtm": "GTM",
    "/budget": "Bütçe",
    "/faturalar": "Faturalar",
    "/search-console": "Search Console",
  };
  const label = map[browserPath] ?? brandName;
  return browserPath === "/" ? brandName : label;
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
    if (!isStaffRole(session.user.role)) {
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

    const staffOk =
      browserPath === "/" ||
      browserPath === "/brands" ||
      browserPath.startsWith("/brands/") ||
      browserPath === "/board" ||
      browserPath.startsWith("/board/") ||
      browserPath === "/ekip" ||
      browserPath.startsWith("/ekip/") ||
      browserPath === "/settings" ||
      browserPath.startsWith("/settings") ||
      browserPath === "/design" ||
      browserPath.startsWith("/design/");
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
            nav={STAFF_NAV_LINKS}
            pageTitle={staffPageTitle(browserPath)}
            userEmail={session.user.email ?? ""}
            userRoleLabel={session.user.role}
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
          nav={TENANT_NAV_LINKS}
          pageTitle={tenantPageTitle(browserPath, tenant.name)}
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
