import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import AuthSessionProvider from "@/components/panel/AuthSessionProvider";
import SignOutButton from "@/components/panel/SignOutButton";
import PanelNavClient from "@/components/panel/PanelNavClient";
import { prisma } from "@/lib/db";
import { resolvePanelTenant } from "@/lib/panel/data";
import { loginHref, sanitizeCallbackPath } from "@/lib/panel/auth-nav";

function buildNav(opts: { ecommerce: boolean; isStaff: boolean }) {
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
  if (opts.isStaff) {
    items.push({ href: "/settings", label: "Ayarlar" });
    items.push({ href: "/brands", label: "Markalar" });
  }
  return items;
}

async function canAccessTenant(
  role: string,
  tenantIds: string[],
  tenantId: string,
  slug: string,
): Promise<boolean> {
  if (role === "admin" || role === "team") return true;
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
  const slug = h.get("x-tenant-slug");
  if (!slug) notFound();

  const session = await auth();
  const browserPath = sanitizeCallbackPath(
    h.get("x-panel-pathname"),
    "/",
  );

  if (!session?.user) {
    redirect(loginHref(browserPath));
  }

  const tenant = await resolvePanelTenant(slug);
  if (!tenant) notFound();

  const allowed = await canAccessTenant(
    session.user.role,
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
              Bu panel yalnızca yetkili olduğunuz markanın verisini gösterir.
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
              Müşteri hesabıysa doğru adresi kullanın — örn.{" "}
              <code className="text-zinc-400">mareen.localhost:3006</code>
            </p>
          </div>
        </main>
      </AuthSessionProvider>
    );
  }

  const isStaff =
    session.user.role === "admin" || session.user.role === "team";
  const ecommerce = tenant.type === "ecommerce";
  const nav = buildNav({ ecommerce, isStaff });
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
            <PanelNavClient items={nav} />
          </nav>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </div>
      </div>
    </AuthSessionProvider>
  );
}
