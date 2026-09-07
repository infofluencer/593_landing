import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import AuthSessionProvider from "@/components/panel/AuthSessionProvider";
import SignOutButton from "@/components/panel/SignOutButton";
import PanelNavClient from "@/components/panel/PanelNavClient";
import { prisma } from "@/lib/db";
import { isStaffRole } from "@/lib/panel/host";
import { resolvePanelTenant } from "@/lib/panel/data";
import { loginHref, sanitizeCallbackPath } from "@/lib/panel/auth-nav";

function buildTenantNav(opts: { ecommerce: boolean }) {
  const items: { href: string; label: string }[] = [
    { href: "/", label: "Sunum" },
    { href: "/meta", label: "Meta" },
    { href: "/google", label: "Google Ads" },
    { href: "/ga4", label: "GA4" },
    { href: "/gtm", label: "GTM" },
    { href: "/budget", label: "Bütçe" },
    { href: "/conversions", label: "Dönüşüm" },
    { href: "/search-console", label: "GSC" },
  ];
  if (opts.ecommerce) {
    items.push({ href: "/merchant", label: "Merchant" });
  }
  items.push({ href: "/alerts", label: "Uyarılar" });
  return items;
}

const STAFF_NAV = [
  { href: "/brands", label: "Markalar" },
  { href: "/settings", label: "Ayarlar" },
];

/** Marka host: yalnızca o tenant membership — admin bypass yok. */
async function canAccessTenantMembership(
  tenantIds: string[],
  tenantId: string,
  slug: string,
): Promise<boolean> {
  if (tenantIds.includes(tenantId)) return true;
  if (tenantIds.length === 0) return false;
  const rows = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { slug: true },
  });
  return rows.some((r) => r.slug === slug);
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
          <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-zinc-800">
            <div className="max-w-md space-y-4 text-center">
              <h1 className="text-lg font-semibold">Erişim yok</h1>
              <p className="text-sm text-zinc-500">
                Bu adres yalnızca ajans (admin/team) hesabı içindir. Marka
                paneliniz için kendi subdomain’inizi kullanın.
              </p>
              <SignOutButton />
            </div>
          </main>
        </AuthSessionProvider>
      );
    }

    // Tenant-only sayfalar staff host’ta yok → marka listesine.
    const staffOk =
      browserPath === "/" ||
      browserPath === "/brands" ||
      browserPath.startsWith("/brands/") ||
      browserPath === "/settings" ||
      browserPath.startsWith("/settings");
    if (!staffOk) {
      redirect("/brands");
    }
    if (browserPath === "/") {
      redirect("/brands");
    }

    return (
      <AuthSessionProvider>
        <div className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
          <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
              <div className="mr-auto min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#e91825]">
                  593 Panel · ajans
                </p>
                <h1 className="truncate text-sm font-semibold text-zinc-900">
                  Marka yönetimi
                </h1>
              </div>
              <p className="hidden text-xs text-zinc-500 sm:block">
                {session.user.email} · {session.user.role}
              </p>
              <SignOutButton />
            </div>
            <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
              <PanelNavClient items={STAFF_NAV} />
            </nav>
          </header>
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
            {children}
          </div>
        </div>
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
        <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-zinc-800">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-lg font-semibold">Erişim yok</h1>
            <p className="text-sm text-zinc-500">
              Bu panel yalnızca yetkili olduğunuz markanın hesabıyla açılır.
              <br />
              <span className="mt-2 inline-block text-zinc-400">
                İstenen marka: {tenant.name} ({slug})
              </span>
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                href="/login?error=AccessDenied"
                className="text-sm text-[#e91825] hover:underline"
              >
                Giriş sayfası
              </Link>
              <SignOutButton />
            </div>
            <p className="text-xs text-zinc-600">
              Ajans hesabı için{" "}
              <code className="text-zinc-400">admin.localhost:3006</code>{" "}
              kullanın.
            </p>
          </div>
        </main>
      </AuthSessionProvider>
    );
  }

  const ecommerce = tenant.type === "ecommerce";
  const nav = buildTenantNav({ ecommerce });
  const typeLabel = ecommerce ? "e-ticaret" : "lead";

  return (
    <AuthSessionProvider>
      <div className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <div className="mr-auto min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#e91825]">
                593 Panel · marka görünümü · {typeLabel}
              </p>
              <h1 className="truncate text-sm font-semibold text-zinc-900">
                {tenant.name}{" "}
                <span className="font-normal text-zinc-500">· {slug}</span>
              </h1>
            </div>
            <p className="hidden text-xs text-zinc-500 sm:block">
              {session.user.email} ·{" "}
              {session.user.role === "client" ? "müşteri" : session.user.role}
            </p>
            <SignOutButton />
          </div>
          <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
            <Suspense fallback={null}>
              <PanelNavClient items={nav} />
            </Suspense>
          </nav>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </div>
      </div>
    </AuthSessionProvider>
  );
}
